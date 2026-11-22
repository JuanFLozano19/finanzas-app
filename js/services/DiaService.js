// Día a día: lista de mercado.
import { today } from '../core/format.js';

export class MercadoService {
  constructor(repos, finanzas) { this.repo = repos.compras; this.finanzas = finanzas; }
  async lista() {
    const items = await this.repo.list({ orderBy: 'orden', ascending: true });
    return { pendientes: items.filter((i) => !i.comprado), comprados: items.filter((i) => i.comprado) };
  }
  agregar(texto, cantidad, orden) { return this.repo.create({ texto, cantidad: cantidad || null, orden }); }
  editar(id, d) { return this.repo.update(id, d); }
  alternar(i) { return this.repo.update(i.id, { comprado: !i.comprado }); }
  eliminar(id) { return this.repo.remove(id); }
  async limpiarComprados(comprados) { for (const i of comprados) await this.repo.remove(i.id); }
  /** Registra el total como gasto de Comida y limpia lo comprado. */
  async terminarCompra(comprados, { total, cuenta_id, lugar }) {
    await this.finanzas.guardarMovimiento(null, {
      tipo: 'gasto', monto: total, categoria: 'Comida', fecha: today(), cuenta_id: cuenta_id || null,
      descripcion: `Mercado${lugar ? ` en ${lugar}` : ''} (${comprados.length} productos)`,
    });
    await this.limpiarComprados(comprados);
  }
}

/** Texto plano de la lista para compartir por WhatsApp o mensaje. */
export function textoLista(pendientes) {
  return `🛒 Lista de mercado\n${pendientes.map((i) => `• ${i.texto}${i.cantidad ? ` (${i.cantidad})` : ''}`).join('\n')}`;
}
