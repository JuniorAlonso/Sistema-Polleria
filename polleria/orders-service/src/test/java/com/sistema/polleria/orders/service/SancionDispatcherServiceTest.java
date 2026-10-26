package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.entity.Orden;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class SancionDispatcherServiceTest {

    private static final String AUTH = "http://auth";
    private static final String INCIDENT = "http://incident";

    private MockRestServiceServer server;
    private SancionDispatcherService dispatcher;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        dispatcher = new SancionDispatcherService(builder.build(), AUTH, INCIDENT, "key");
    }

    private Orden ordenConCliente(Long clienteId) {
        return Orden.builder()
                .id(77L)
                .clienteId(clienteId)
                .telefonoCliente("987654321")
                .nombreCliente("Ana")
                .ipOrigen("10.1.2.3")
                .build();
    }

    @Test
    void sendsResolvedEmailPhoneAndIpInTheSanction() {
        server.expect(requestTo(AUTH + "/auth/internal/usuarios/5/email"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("X-Internal-Key", "key"))
                .andRespond(withSuccess("{\"email\":\"ana@test.com\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(AUTH + "/auth/sanciones"))
                .andExpect(jsonPath("$.email").value("ana@test.com"))
                .andExpect(jsonPath("$.telefono").value("987654321"))
                .andExpect(jsonPath("$.ipAddress").value("10.1.2.3"))
                .andExpect(jsonPath("$.bloqueadoEfectivo").value(true))
                .andRespond(withStatus(org.springframework.http.HttpStatus.CREATED));
        server.expect(requestTo(INCIDENT + "/incidentes")).andRespond(withStatus(org.springframework.http.HttpStatus.CREATED));

        dispatcher.registrarSancionPorPedidoFantasma(ordenConCliente(5L), "no abrió");

        server.verify();
    }

    @Test
    void stillRegistersPhoneAndIpWhenTheEmailLookupFails() {
        server.expect(requestTo(AUTH + "/auth/internal/usuarios/5/email")).andRespond(withServerError());
        server.expect(requestTo(AUTH + "/auth/sanciones"))
                .andExpect(jsonPath("$.email").doesNotExist())
                .andExpect(jsonPath("$.telefono").value("987654321"))
                .andExpect(jsonPath("$.ipAddress").value("10.1.2.3"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.CREATED));
        server.expect(requestTo(INCIDENT + "/incidentes")).andRespond(withStatus(org.springframework.http.HttpStatus.CREATED));

        dispatcher.registrarSancionPorPedidoFantasma(ordenConCliente(5L), "no abrió");

        server.verify();
    }

    @Test
    void doesNotLookUpTheEmailForGuestOrders() {
        assertNull(dispatcher.resolverEmailCliente(ordenConCliente(null)));
        assertNull(dispatcher.resolverEmailCliente(ordenConCliente(0L)));
        server.verify();
    }

    @Test
    void blocksCashWhenAuthReportsBloqueadoEfectivoAndEncodesTheEmail() {
        server.expect(requestTo(AUTH + "/auth/sanciones/verificar?telefono=987654321&email=a%2Bb%40test.com&ip=10.1.2.3"))
                .andExpect(header("X-Internal-Key", "key"))
                .andRespond(withSuccess("{\"sancionado\":true,\"bloqueadoEfectivo\":true,\"bloqueadoTotal\":false}",
                        MediaType.APPLICATION_JSON));

        assertTrue(dispatcher.tieneSancionActiva("987654321", "a+b@test.com", "10.1.2.3"));
        server.verify();
    }

    @Test
    void doesNotBlockWhenNotSanctionedOrAuthFails() {
        server.expect(requestTo(AUTH + "/auth/sanciones/verificar?telefono=911222333"))
                .andRespond(withSuccess("{\"sancionado\":false,\"bloqueadoEfectivo\":false,\"bloqueadoTotal\":false}",
                        MediaType.APPLICATION_JSON));
        server.expect(requestTo(AUTH + "/auth/sanciones/verificar?telefono=911222333"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS));

        assertFalse(dispatcher.tieneSancionActiva("911222333", null, null));
        assertFalse(dispatcher.tieneSancionActiva("911222333", null, null));
        server.verify();
    }
}
