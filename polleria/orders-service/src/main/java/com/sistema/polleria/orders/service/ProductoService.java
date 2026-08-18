package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.ProductoRequest;
import com.sistema.polleria.orders.dto.ProductoResponse;
import com.sistema.polleria.orders.entity.Categoria;
import com.sistema.polleria.orders.entity.Producto;
import com.sistema.polleria.orders.repository.ProductoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductoService {

    private final ProductoRepository productoRepository;

    public List<ProductoResponse> listarDisponibles() {
        return productoRepository.findByDisponibleTrue()
                .stream().map(ProductoResponse::from).toList();
    }

    public List<ProductoResponse> listarTodos() {
        return productoRepository.findAll()
                .stream().map(ProductoResponse::from).toList();
    }

    public List<ProductoResponse> listarPorCategoria(Categoria categoria, boolean soloDisponibles) {
        List<Producto> productos = soloDisponibles
                ? productoRepository.findByCategoriaAndDisponibleTrue(categoria)
                : productoRepository.findByCategoria(categoria);
        return productos.stream().map(ProductoResponse::from).toList();
    }

    public ProductoResponse obtener(Long id) {
        return ProductoResponse.from(buscarOFallar(id));
    }

    @Transactional
    public ProductoResponse crear(ProductoRequest request) {
        Producto producto = Producto.builder()
                .nombre(request.getNombre())
                .descripcion(request.getDescripcion())
                .precio(request.getPrecio())
                .categoria(request.getCategoria())
                .imagenUrl(request.getImagenUrl())
                .disponible(request.isDisponible())
                .build();
        productoRepository.save(producto);
        log.info("Producto creado: {} ({})", producto.getNombre(), producto.getCategoria());
        return ProductoResponse.from(producto);
    }

    @Transactional
    public ProductoResponse actualizar(Long id, ProductoRequest request) {
        Producto producto = buscarOFallar(id);
        producto.setNombre(request.getNombre());
        producto.setDescripcion(request.getDescripcion());
        producto.setPrecio(request.getPrecio());
        producto.setCategoria(request.getCategoria());
        producto.setImagenUrl(request.getImagenUrl());
        producto.setDisponible(request.isDisponible());
        productoRepository.save(producto);
        log.info("Producto actualizado: {}", id);
        return ProductoResponse.from(producto);
    }

    @Transactional
    public ProductoResponse toggleDisponibilidad(Long id) {
        Producto producto = buscarOFallar(id);
        producto.setDisponible(!producto.isDisponible());
        productoRepository.save(producto);
        log.info("Producto {} marcado como {}", id, producto.isDisponible() ? "disponible" : "agotado");
        return ProductoResponse.from(producto);
    }

    @Transactional
    public void eliminar(Long id) {
        buscarOFallar(id);
        productoRepository.deleteById(id);
        log.info("Producto eliminado: {}", id);
    }

    public Producto buscarOFallar(Long id) {
        return productoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado: " + id));
    }
}
