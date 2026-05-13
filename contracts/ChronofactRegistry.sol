// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ChronofactRegistry
/// @notice Minimal course-demo registry for file-version notarization.
/// @dev Stores only digest and version linkage metadata. Original files and
/// sensitive business payloads must stay off-chain.
contract ChronofactRegistry {
    struct FileVersionRecord {
        bytes32 digest;
        uint64 versionNo;
        address submitter;
        bytes32 previousVersion;
        uint256 timestamp;
    }

    mapping(bytes32 => FileVersionRecord) private records;

    event FileVersionRegistered(
        bytes32 indexed recordId,
        bytes32 indexed digest,
        uint64 versionNo,
        address indexed submitter,
        bytes32 previousVersion,
        uint256 timestamp
    );

    error EmptyDigest();
    error InvalidVersion();
    error RecordAlreadyExists(bytes32 recordId);
    error RecordNotFound(bytes32 recordId);

    function registerVersion(
        bytes32 digest,
        uint64 versionNo,
        bytes32 previousVersion
    ) external returns (bytes32 recordId) {
        if (digest == bytes32(0)) {
            revert EmptyDigest();
        }
        if (versionNo == 0) {
            revert InvalidVersion();
        }

        recordId = computeRecordId(digest, versionNo, msg.sender, previousVersion);
        if (records[recordId].timestamp != 0) {
            revert RecordAlreadyExists(recordId);
        }

        uint256 timestamp = block.timestamp;
        records[recordId] = FileVersionRecord({
            digest: digest,
            versionNo: versionNo,
            submitter: msg.sender,
            previousVersion: previousVersion,
            timestamp: timestamp
        });

        emit FileVersionRegistered(
            recordId,
            digest,
            versionNo,
            msg.sender,
            previousVersion,
            timestamp
        );
    }

    function getRecord(bytes32 recordId) external view returns (FileVersionRecord memory record) {
        record = records[recordId];
        if (record.timestamp == 0) {
            revert RecordNotFound(recordId);
        }
    }

    function verifyDigest(bytes32 recordId, bytes32 digest) external view returns (bool) {
        FileVersionRecord memory record = records[recordId];
        if (record.timestamp == 0) {
            revert RecordNotFound(recordId);
        }
        return record.digest == digest;
    }

    function computeRecordId(
        bytes32 digest,
        uint64 versionNo,
        address submitter,
        bytes32 previousVersion
    ) public view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                digest,
                versionNo,
                submitter,
                previousVersion
            )
        );
    }
}
