package com.pixous.hrportal.modules.asset;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AssetAllocationRepository extends JpaRepository<AssetAllocation, Long> {
    List<AssetAllocation> findByUserIdAndReturnedAtIsNull(Long userId);
    Optional<AssetAllocation> findByAssetIdAndReturnedAtIsNull(Long assetId);
}
