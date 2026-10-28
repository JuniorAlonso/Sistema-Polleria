package com.sistema.polleria.auth.repository;

import com.sistema.polleria.auth.entity.SancionCliente;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * orders-service checks sanctions with only the phone (e-mail and IP are null for guests).
 * On PostgreSQL an untyped null bound into LOWER(:email) arrives as bytea and the query failed
 * with "function lower(bytea) does not exist", so the check answered 500 and failed open.
 */
@SpringBootTest
@ActiveProfiles("test")
@DisplayName("Sanction lookups accept null e-mail and IP on PostgreSQL")
class SancionClienteRepositoryNullParamsTest {

    @Autowired
    private SancionClienteRepository repository;

    @Test
    void existeSancionConSoloTelefono() {
        assertFalse(assertDoesNotThrow(() -> repository.existeSancion("51900000999", null, null)));
    }

    @Test
    void buscarCoincidenciasConSoloTelefono() {
        assertDoesNotThrow(() -> repository.buscarCoincidencias("51900000999", null, null));
    }

    @Test
    void elEmailSigueCoincidiendoSinDistinguirMayusculas() {
        SancionCliente sancion = repository.save(SancionCliente.builder()
                .email("Probe.Null.Params@Example.com").motivo("test").build());
        try {
            assertTrue(repository.existeSancion(null, "probe.null.params@example.com", null));
        } finally {
            repository.delete(sancion);
        }
    }
}
