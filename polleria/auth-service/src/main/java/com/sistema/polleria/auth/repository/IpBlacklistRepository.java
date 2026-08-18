package com.sistema.polleria.auth.repository;

import com.sistema.polleria.auth.entity.IpBlacklist;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface IpBlacklistRepository extends JpaRepository<IpBlacklist, Long> {
    Optional<IpBlacklist> findByIp(String ip);
}
