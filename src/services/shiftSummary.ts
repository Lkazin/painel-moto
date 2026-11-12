export interface ShiftSummaryInput {
  driverName: string;
  vehicleModel?: string | null;
  vehiclePlate: string;
  storeName?: string | null;
  completed: number;
  total: number;
  at: Date;
}

/**
 * Texto do fechamento enviado à loja pelo WhatsApp.
 * Função pura: a data entra por parâmetro, então o resultado é previsível e testável.
 */
export function buildShiftSummary(input: ShiftSummaryInput): string {
  const when = input.at.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  return `📋 *FECHAMENTO DE PLANTÃO - ${input.driverName.toUpperCase()}\n` +
    `🏍️ Veículo: ${input.vehicleModel || 'Moto'} (Placa ${input.vehiclePlate})\n` +
    `🏪 Estabelecimento: ${input.storeName || 'Pizzaria'}\n` +
    `📅 Data/Hora: ${when}\n\n` +
    `✅ *Entregas concluídas com PIN:* ${input.completed}\n` +
    `💵 *Total de Valores das entregas:* R$ ${input.total.toFixed(2).replace('.', ',')}\n\n` +
    `_Enviado pelo App do Entregador_`;
}
