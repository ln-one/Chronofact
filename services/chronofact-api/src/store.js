import { createHash } from "node:crypto";
import { ChronofactError } from "./errors.js";

export function createInMemoryStore({ clock = () => new Date() } = {}) {
  const workspaces = new Map();
  const assets = new Map();
  const versions = new Map();
  const uploads = new Map();
  const preservationRecords = new Map();
  const reviewRecords = new Map();
  const auditLogs = [];
  let workspaceCounter = 1;
  let assetCounter = 1;
  let versionCounter = 1;
  let uploadCounter = 1;
  let preservationCounter = 1;
  let reviewCounter = 1;
  let auditCounter = 1;

  function nextId(prefix, counter) {
    return `${prefix}_${String(counter).padStart(3, "0")}`;
  }

  function isWithinDateRange(value, from, to) {
    if (!value) return false;
    if (from && value < from) return false;
    if (to && value > to) return false;
    return true;
  }

  function auditHash(entry) {
    return createHash("sha256").update(JSON.stringify(entry)).digest("hex");
  }

  return {
    createWorkspace({
      title,
      workspaceType = "experiment",
      description = "",
      status = "active",
      ownerId
    }) {
      const workspaceId = nextId("ws", workspaceCounter++);
      const workspace = {
        workspace_id: workspaceId,
        title,
        workspace_type: workspaceType,
        description,
        status,
        owner_id: ownerId,
        created_at: clock().toISOString(),
        asset_ids: []
      };
      workspaces.set(workspaceId, workspace);
      this.appendAudit({
        workspaceId,
        actorId: ownerId,
        action: "workspace_created",
        target_type: "workspace",
        target_id: workspaceId,
        summary: `Workspace ${title} was created.`
      });
      return workspace;
    },

    updateWorkspaceStatus({ workspaceId, status, actorId }) {
      const workspace = this.requireWorkspace(workspaceId);
      const previousStatus = workspace.status;
      workspace.status = status;
      workspace.updated_at = clock().toISOString();
      this.appendAudit({
        workspaceId,
        actorId,
        action: "workspace_status_updated",
        target_type: "workspace",
        target_id: workspaceId,
        summary: `Workspace status changed from ${previousStatus} to ${status}.`
      });
      return workspace;
    },

    listWorkspaces({ status, workspaceType, query, createdFrom, createdTo } = {}) {
      const normalizedQuery = query ? String(query).toLowerCase() : null;
      return Array.from(workspaces.values()).filter((workspace) => {
        if (status && workspace.status !== status) return false;
        if (workspaceType && workspace.workspace_type !== workspaceType) return false;
        if ((createdFrom || createdTo) && !isWithinDateRange(workspace.created_at, createdFrom, createdTo)) return false;
        if (
          normalizedQuery &&
          !`${workspace.title} ${workspace.description}`.toLowerCase().includes(normalizedQuery)
        ) {
          return false;
        }
        return true;
      });
    },

    getWorkspace(workspaceId) {
      return workspaces.get(workspaceId) ?? null;
    },

    requireWorkspace(workspaceId) {
      const workspace = workspaces.get(workspaceId);
      if (!workspace) {
        throw new ChronofactError("workspace_not_found", `Workspace ${workspaceId} was not found.`, 404);
      }
      return workspace;
    },

    allocateUploadId() {
      return nextId("upl", uploadCounter++);
    },

    createAsset({ assetType, workspaceId = null, title = null, createdBy = null }) {
      const workspace = workspaceId ? this.requireWorkspace(workspaceId) : null;
      const assetId = nextId("asset", assetCounter++);
      const asset = {
        asset_id: assetId,
        workspace_id: workspace?.workspace_id ?? null,
        title: title ?? null,
        asset_type: assetType,
        status: "active",
        created_by: createdBy,
        created_at: clock().toISOString(),
        version_ids: []
      };
      assets.set(assetId, asset);
      if (workspace) {
        workspace.asset_ids.push(assetId);
      }
      return asset;
    },

    getAsset(assetId) {
      return assets.get(assetId) ?? null;
    },

    requireAsset(assetId) {
      const asset = assets.get(assetId);
      if (!asset) {
        throw new ChronofactError("asset_not_found", `Asset ${assetId} was not found.`, 404);
      }
      return asset;
    },

    getVersion(versionId) {
      return versions.get(versionId) ?? null;
    },

    requireVersion(versionId) {
      const version = versions.get(versionId);
      if (!version) {
        throw new ChronofactError("version_not_found", `Version ${versionId} was not found.`, 404);
      }
      return version;
    },

    latestVersion(assetId) {
      const asset = this.requireAsset(assetId);
      const lastId = asset.version_ids.at(-1);
      return lastId ? versions.get(lastId) : null;
    },

    listVersions(assetId) {
      const asset = this.requireAsset(assetId);
      return asset.version_ids.map((id) => versions.get(id));
    },

    listAssets({
      workspaceId,
      status,
      assetType,
      query,
      verificationStatus,
      failureReason,
      createdFrom,
      createdTo
    } = {}) {
      if (workspaceId) {
        this.requireWorkspace(workspaceId);
      }
      const normalizedQuery = query ? String(query).toLowerCase() : null;
      return Array.from(assets.values())
        .filter((asset) => {
          const latestVersion = asset.version_ids.length ? versions.get(asset.version_ids.at(-1)) : null;
          const preservationRecord = latestVersion?.preservation_record ?? null;
          if (workspaceId && asset.workspace_id !== workspaceId) return false;
          if (status && asset.status !== status) return false;
          if (assetType && asset.asset_type !== assetType) return false;
          if ((createdFrom || createdTo) && !isWithinDateRange(asset.created_at, createdFrom, createdTo)) return false;
          if (verificationStatus && preservationRecord?.verification_status !== verificationStatus) return false;
          if (failureReason && preservationRecord?.failure_reason !== failureReason) return false;
          if (normalizedQuery && !`${asset.title ?? ""} ${asset.asset_type}`.toLowerCase().includes(normalizedQuery)) {
            return false;
          }
          return true;
        })
        .map((asset) => ({
          ...asset,
          latest_version: asset.version_ids.length ? versions.get(asset.version_ids.at(-1)) : null
        }));
    },

    saveUpload(uploadRecord) {
      uploads.set(uploadRecord.upload_id, uploadRecord);
      return uploadRecord;
    },

    createVersion({
      assetId,
      assetType,
      workspaceId,
      assetTitle,
      uploadRecord,
      sha256,
      submitterId,
      previousVersionId = null
    }) {
      const asset = assetId
        ? this.requireAsset(assetId)
        : this.createAsset({
            assetType,
            workspaceId,
            title: assetTitle ?? uploadRecord.filename,
            createdBy: submitterId
          });

      if (workspaceId && asset.workspace_id !== workspaceId) {
        throw new ChronofactError(
          "workspace_asset_mismatch",
          "Asset does not belong to the requested workspace.",
          409
        );
      }

      const previousVersion = previousVersionId ? this.requireVersion(previousVersionId) : this.latestVersion(asset.asset_id);

      if (previousVersion && previousVersion.asset_id !== asset.asset_id) {
        throw new ChronofactError(
          "invalid_previous_version",
          "Previous version must belong to the same asset.",
          409
        );
      }

      const versionNo = previousVersion ? previousVersion.version_no + 1 : 1;
      const versionId = nextId("ver", versionCounter++);
      const assetVersion = {
        asset_id: asset.asset_id,
        workspace_id: asset.workspace_id,
        asset_type: asset.asset_type,
        version_id: versionId,
        version_no: versionNo,
        previous_version_id: previousVersion?.version_id ?? null,
        sha256,
        submitter_id: submitterId,
        upload_id: uploadRecord.upload_id,
        storage_ref: uploadRecord.storage_ref,
        fact_id: null,
        receipt_id: null,
        previous_fact_id: previousVersion?.fact_id ?? null,
        review_ids: [],
        created_at: clock().toISOString()
      };

      versions.set(versionId, assetVersion);
      asset.version_ids.push(versionId);
      this.appendAudit({
        workspaceId: asset.workspace_id,
        assetId: asset.asset_id,
        versionId,
        actorId: submitterId,
        action: versionNo === 1 ? "asset_created" : "asset_version_created",
        target_type: "asset_version",
        target_id: versionId,
        summary: `Asset ${asset.asset_id} version ${versionNo} was stored and prepared for witnessing.`
      });
      return assetVersion;
    },

    attachWitness(versionId, witnessRecord) {
      const version = this.requireVersion(versionId);
      version.fact_id = witnessRecord.fact_id;
      version.receipt_id = witnessRecord.receipt_id;
      version.previous_fact_id = witnessRecord.previous_fact_id;
      version.witness_record = witnessRecord;
      return version;
    },

    getPreservationRecord(preservationId) {
      return preservationRecords.get(preservationId) ?? null;
    },

    requirePreservationRecord(preservationId) {
      const record = preservationRecords.get(preservationId);
      if (!record) {
        throw new ChronofactError(
          "preservation_record_not_found",
          `Preservation record ${preservationId} was not found.`,
          404
        );
      }
      return record;
    },

    createPreservationRecord({ assetVersion, witnessRecord, verificationResult }) {
      const preservationId = nextId("prv", preservationCounter++);
      const record = {
        preservation_id: preservationId,
        asset_id: assetVersion.asset_id,
        version_id: assetVersion.version_id,
        digest_algorithm: "sha256",
        digest: assetVersion.sha256,
        storage_ref: assetVersion.storage_ref,
        fact_id: witnessRecord.fact_id,
        receipt_id: witnessRecord.receipt_id,
        anchor_status: witnessRecord.anchor_status,
        verification_status: verificationResult.status,
        failure_reason: verificationResult.failure_reason,
        created_at: clock().toISOString()
      };
      preservationRecords.set(preservationId, record);
      assetVersion.preservation_record_id = preservationId;
      assetVersion.preservation_record = record;
      this.appendAudit({
        workspaceId: this.requireAsset(assetVersion.asset_id).workspace_id,
        assetId: assetVersion.asset_id,
        versionId: assetVersion.version_id,
        actorId: assetVersion.submitter_id,
        action: "preservation_record_created",
        target_type: "preservation_record",
        target_id: preservationId,
        summary: `Preservation record ${preservationId} was created for version ${assetVersion.version_no}.`
      });
      return record;
    },

    listPreservationRecords({
      workspaceId,
      assetId,
      versionId,
      verificationStatus,
      failureReason,
      createdFrom,
      createdTo
    } = {}) {
      if (workspaceId) {
        this.requireWorkspace(workspaceId);
      }
      if (assetId) {
        this.requireAsset(assetId);
      }
      if (versionId) {
        this.requireVersion(versionId);
      }

      return Array.from(preservationRecords.values()).filter((record) => {
        const asset = assets.get(record.asset_id);
        if (workspaceId && asset?.workspace_id !== workspaceId) return false;
        if (assetId && record.asset_id !== assetId) return false;
        if (versionId && record.version_id !== versionId) return false;
        if (verificationStatus && record.verification_status !== verificationStatus) return false;
        if (failureReason && record.failure_reason !== failureReason) return false;
        if ((createdFrom || createdTo) && !isWithinDateRange(record.created_at, createdFrom, createdTo)) return false;
        return true;
      });
    },

    createReviewRecord({
      versionId,
      reviewerId,
      decision,
      summary = "",
      notes = "",
      nextChecks = []
    }) {
      const version = this.requireVersion(versionId);
      const asset = this.requireAsset(version.asset_id);
      const reviewId = nextId("rev", reviewCounter++);
      const review = {
        review_id: reviewId,
        workspace_id: asset.workspace_id,
        asset_id: asset.asset_id,
        version_id: version.version_id,
        reviewer_id: reviewerId,
        decision,
        summary,
        notes,
        next_checks: Array.isArray(nextChecks) ? nextChecks : [],
        created_at: clock().toISOString()
      };
      reviewRecords.set(reviewId, review);
      version.review_ids.push(reviewId);
      this.appendAudit({
        workspaceId: asset.workspace_id,
        assetId: asset.asset_id,
        versionId: version.version_id,
        actorId: reviewerId,
        action: "review_record_created",
        target_type: "review_record",
        target_id: reviewId,
        summary: `Manual review ${reviewId} recorded decision ${decision}.`
      });
      return review;
    },

    listReviewRecords({
      workspaceId,
      assetId,
      versionId,
      decision,
      reviewerId,
      createdFrom,
      createdTo
    } = {}) {
      if (workspaceId) {
        this.requireWorkspace(workspaceId);
      }
      if (assetId) {
        this.requireAsset(assetId);
      }
      if (versionId) {
        this.requireVersion(versionId);
      }

      return Array.from(reviewRecords.values()).filter((review) => {
        if (workspaceId && review.workspace_id !== workspaceId) return false;
        if (assetId && review.asset_id !== assetId) return false;
        if (versionId && review.version_id !== versionId) return false;
        if (decision && review.decision !== decision) return false;
        if (reviewerId && review.reviewer_id !== reviewerId) return false;
        if ((createdFrom || createdTo) && !isWithinDateRange(review.created_at, createdFrom, createdTo)) return false;
        return true;
      });
    },

    appendAudit({
      workspaceId = null,
      assetId = null,
      versionId = null,
      actorId = null,
      action,
      target_type,
      target_id,
      summary
    }) {
      const entry = {
        audit_id: nextId("aud", auditCounter++),
        workspace_id: workspaceId,
        asset_id: assetId,
        version_id: versionId,
        actor_id: actorId,
        action,
        target_type,
        target_id,
        summary,
        created_at: clock().toISOString(),
        previous_hash: auditLogs.at(-1)?.entry_hash ?? null
      };
      entry.entry_hash = auditHash(entry);
      auditLogs.push(entry);
      return entry;
    },

    listAuditLogs({ workspaceId, assetId, versionId, action, createdFrom, createdTo } = {}) {
      return auditLogs.filter((entry) => {
        if (workspaceId && entry.workspace_id !== workspaceId) return false;
        if (assetId && entry.asset_id !== assetId) return false;
        if (versionId && entry.version_id !== versionId) return false;
        if (action && entry.action !== action) return false;
        if ((createdFrom || createdTo) && !isWithinDateRange(entry.created_at, createdFrom, createdTo)) return false;
        return true;
      });
    },

    verifyAuditChain({ workspaceId, assetId, versionId, action, createdFrom, createdTo } = {}) {
      let previousHash = null;
      let firstInvalid = null;

      for (const entry of auditLogs) {
        const { entry_hash: entryHash, ...hashableEntry } = entry;
        const expectedHash = auditHash(hashableEntry);
        if (entry.previous_hash !== previousHash || entryHash !== expectedHash) {
          firstInvalid = {
            audit_id: entry.audit_id,
            expected_previous_hash: previousHash,
            actual_previous_hash: entry.previous_hash,
            expected_entry_hash: expectedHash,
            actual_entry_hash: entryHash
          };
          break;
        }
        previousHash = entryHash;
      }

      const scopedEntries = this.listAuditLogs({
        workspaceId,
        assetId,
        versionId,
        action,
        createdFrom,
        createdTo
      });

      return {
        valid: firstInvalid === null,
        checked_count: auditLogs.length,
        scoped_count: scopedEntries.length,
        latest_entry_hash: auditLogs.at(-1)?.entry_hash ?? null,
        first_invalid: firstInvalid
      };
    },

    describeAsset(assetId) {
      const asset = this.requireAsset(assetId);
      return {
        ...asset,
        versions: this.listVersions(assetId),
        audit_log: this.listAuditLogs({ assetId })
      };
    },

    describeEvidence({ versionId, preservationId } = {}) {
      const record = preservationId
        ? this.requirePreservationRecord(preservationId)
        : this.listPreservationRecords({ versionId })[0];
      if (!record) {
        throw new ChronofactError(
          "preservation_record_not_found",
          "No preservation record exists for the requested version.",
          404
        );
      }

      const asset = this.requireAsset(record.asset_id);
      const version = this.requireVersion(record.version_id);
      return {
        asset,
        asset_version: version,
        preservation_record: record,
        witness_record: version.witness_record ?? null,
        review_records: this.listReviewRecords({ versionId: version.version_id }),
        audit_log: this.listAuditLogs({ assetId: asset.asset_id, versionId: version.version_id })
      };
    },

    describeWorkspace(workspaceId) {
      const workspace = this.requireWorkspace(workspaceId);
      const workspaceAssets = this.listAssets({ workspaceId });
      return {
        ...workspace,
        assets: workspaceAssets,
        audit_log: this.listAuditLogs({ workspaceId })
      };
    }
  };
}
