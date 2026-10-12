/**
 * Normaliza un teléfono peruano al formato que usa WhatsApp: 51 + 9 dígitos.
 * Devuelve null si el número no tiene un formato válido.
 */
function normalizarTelefono(telefono) {
    if (telefono === undefined || telefono === null) return null;

    let numero = String(telefono).replace(/\D/g, '');
    if (numero.startsWith('0')) numero = numero.slice(1);
    if (numero.length === 9) numero = '51' + numero;

    // Celular peruano: 51 + 9 + 8 dígitos
    if (!/^519\d{8}$/.test(numero)) return null;

    return numero;
}

module.exports = { normalizarTelefono };
