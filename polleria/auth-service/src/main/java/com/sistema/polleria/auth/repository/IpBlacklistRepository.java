package com.sistema.polleria.auth.repository;

import com.sistema.polleria.auth.entity.IpBlacklist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface IpBlacklistRepository extends JpaRepository<IpBlacklist, Long> {

    Optional<IpBlacklist> findByIp(String ip);

    List<IpBlacklist> findByBlockedUntilAfterOrderByBlockedUntilDesc(LocalDateTime now);

    List<IpBlacklist> findAllByOrderByLastAttemptDesc();
}
