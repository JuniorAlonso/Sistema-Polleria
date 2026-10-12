package com.sistema.polleria.orders.repository;

import com.sistema.polleria.orders.entity.ZonaSalon;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ZonaSalonRepository extends JpaRepository<ZonaSalon, Long> {
    List<ZonaSalon> findByActivoTrueOrderByOrdenAsc();
    Optional<ZonaSalon> findBySlug(String slug);
    boolean existsBySlug(String slug);
}
