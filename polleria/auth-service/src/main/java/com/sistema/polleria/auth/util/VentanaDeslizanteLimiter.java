package com.sistema.polleria.auth.util;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/** Simple in-memory sliding-window rate limiter, one window per key (e.g. client IP). */
public class VentanaDeslizanteLimiter {

    private final int maxPeticiones;
    private final long ventanaMs;
    private final LongSupplier reloj;
    private final Map<String, Deque<Long>> ventanas = new ConcurrentHashMap<>();
    private long ultimaLimpieza;

    public VentanaDeslizanteLimiter(int maxPeticiones, long ventanaMs) {
        this(maxPeticiones, ventanaMs, System::currentTimeMillis);
    }

    public VentanaDeslizanteLimiter(int maxPeticiones, long ventanaMs, LongSupplier reloj) {
        this.maxPeticiones = maxPeticiones;
        this.ventanaMs = ventanaMs;
        this.reloj = reloj;
        this.ultimaLimpieza = reloj.getAsLong();
    }

    /** Returns true when the request is allowed and records it; false when the key exceeded the limit. */
    public boolean permitir(String clave) {
        long ahora = reloj.getAsLong();
        limpiarSiCorresponde(ahora);
        Deque<Long> ventana = ventanas.computeIfAbsent(clave, k -> new ArrayDeque<>());
        synchronized (ventana) {
            while (!ventana.isEmpty() && ahora - ventana.peekFirst() >= ventanaMs) {
                ventana.pollFirst();
            }
            if (ventana.size() >= maxPeticiones) {
                return false;
            }
            ventana.addLast(ahora);
            return true;
        }
    }

    private synchronized void limpiarSiCorresponde(long ahora) {
        if (ahora - ultimaLimpieza < ventanaMs) return;
        ultimaLimpieza = ahora;
        ventanas.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                return e.getValue().isEmpty() || ahora - e.getValue().peekLast() >= ventanaMs;
            }
        });
    }
}
