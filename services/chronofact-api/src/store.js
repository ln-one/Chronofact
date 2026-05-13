import { ChronofactError } from "./errors.js";

export function createInMemoryStore({ clock = () => new Date() } = {}) {
  const assets = new Map();
  const versions = new Map();
  const uploads = new Map();
  let assetCounter = 1;
  let versionCounter = 1;
  let uploadCounter = 1;

  function nextId(prefix, counter) {
    return `${prefix}_${String(counter).padStart(3, "0")}`;
  }

  return {
    allocateUploadId() {
      return nextId("upl", uploadCounter++);
    },

    createAsset({ assetType }) {
      const assetId = nextId("asset", assetCounter++);
      const asset = {
        asset_id: assetId,
        asset_type: assetType,
        created_at: clock().toISOString(),
        version_ids: []
      };
      assets.set(assetId, asset);
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

    saveUpload(uploadRecord) {
      uploads.set(uploadRecord.upload_id, uploadRecord);
      return uploadRecord;
    },

    createVersion({
      assetId,
      assetType,
      uploadRecord,
      sha256,
      submitterId,
      previousVersionId = null
    }) {
      const asset = assetId ? this.requireAsset(assetId) : this.createAsset({ assetType });
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
        created_at: clock().toISOString()
      };

      versions.set(versionId, assetVersion);
      asset.version_ids.push(versionId);
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

    describeAsset(assetId) {
      const asset = this.requireAsset(assetId);
      return {
        ...asset,
        versions: this.listVersions(assetId)
      };
    }
  };
}
