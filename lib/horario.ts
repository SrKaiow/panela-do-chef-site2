/**
 * Horário de funcionamento no fuso de Londres. Funciona igual no servidor e no navegador.
 */

const FUSO = "Europe/London";
const ROTULO_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

type Horarios = ([string, string] | null)[];

/** Data e hora em Londres para um instante. */
export function emLondres(d: Date) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)!.value;
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(v("weekday"));
  return { ano: +v("year"), mes: +v("month"), dia: +v("day"), hora: +v("hour"), minuto: +v("minute"), dow };
}

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Instante (UTC) de uma hora local de Londres em um dia (ano/mês/dia locais). */
export function instanteLondres(ano: number, mes: number, dia: number, minutoDoDia: number) {
  // Chuta em UTC e corrige pela diferença do fuso naquele momento (cobre horário de verão).
  const chute = Date.UTC(ano, mes - 1, dia, 0, 0) + minutoDoDia * 60000;
  const l = emLondres(new Date(chute));
  const localComoUtc = Date.UTC(l.ano, l.mes - 1, l.dia, l.hora, l.minuto);
  return new Date(chute - (localComoUtc - chute));
}

/** Soma dias a uma data local (ano/mês/dia) sem depender de fuso. */
function somarDias(ano: number, mes: number, dia: number, n: number) {
  const d = new Date(Date.UTC(ano, mes - 1, dia + n));
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate(), dow: d.getUTCDay() };
}

export type Estado = {
  aberto: boolean;
  pausado: boolean;
  /** Hora em que fecha hoje, se está aberto. */
  fechaAs: string | null;
  /** Próxima abertura (quando está fechado). */
  proxima: { quando: string; dow: number; abre: string; instante: string } | null;
};

export function estadoLoja(horarios: Horarios, pausado: boolean, agora = new Date()): Estado {
  const l = emLondres(agora);
  const agoraMin = l.hora * 60 + l.minuto;
  const hoje = horarios[l.dow];
  const dentro = !!hoje && agoraMin >= minutos(hoje[0]) && agoraMin < minutos(hoje[1]);

  if (dentro && !pausado) return { aberto: true, pausado: false, fechaAs: hoje![1], proxima: null };

  // Próxima abertura: ainda hoje (se não abriu) ou nos próximos 7 dias.
  for (let n = 0; n <= 7; n++) {
    const d = somarDias(l.ano, l.mes, l.dia, n);
    const h = horarios[d.dow];
    if (!h) continue;
    if (n === 0 && (agoraMin >= minutos(h[0]) || pausado)) continue;
    const quando = n === 0 ? "hoje" : n === 1 ? "amanhã" : ROTULO_DIA[d.dow];
    return {
      aberto: false,
      pausado,
      fechaAs: null,
      proxima: { quando, dow: d.dow, abre: h[0], instante: instanteLondres(d.ano, d.mes, d.dia, minutos(h[0])).toISOString() },
    };
  }
  return { aberto: false, pausado, fechaAs: null, proxima: null };
}

export type Horario = { valor: string; rotulo: string };

/**
 * Horários para agendar um pedido: de 30 em 30 minutos, a partir de 30 minutos depois de abrir,
 * nos próximos dois dias de funcionamento.
 */
export function horariosParaAgendar(horarios: Horarios, agora = new Date(), dias = 2): Horario[] {
  const l = emLondres(agora);
  const lista: Horario[] = [];
  let achados = 0;
  for (let n = 0; n <= 7 && achados < dias; n++) {
    const d = somarDias(l.ano, l.mes, l.dia, n);
    const h = horarios[d.dow];
    if (!h) continue;
    const ini = minutos(h[0]) + 30;
    const fim = minutos(h[1]);
    let pos = 0;
    for (let m = ini; m <= fim; m += 30) {
      const instante = instanteLondres(d.ano, d.mes, d.dia, m);
      if (instante.getTime() < agora.getTime() + 45 * 60000) continue; // pelo menos 45 min à frente
      const dia = n === 0 ? "Hoje" : n === 1 ? "Amanhã" : ROTULO_DIA[d.dow][0].toUpperCase() + ROTULO_DIA[d.dow].slice(1);
      lista.push({ valor: instante.toISOString(), rotulo: `${dia}, ${hhmm(m)}` });
      pos++;
    }
    if (pos) achados++;
  }
  return lista;
}

/** "Amanhã, 12:30" para um instante agendado. */
export function rotuloAgendado(iso: string, agora = new Date()) {
  const a = emLondres(agora);
  const d = emLondres(new Date(iso));
  const dias = Math.round((Date.UTC(d.ano, d.mes - 1, d.dia) - Date.UTC(a.ano, a.mes - 1, a.dia)) / 86400000);
  const dia = dias === 0 ? "hoje" : dias === 1 ? "amanhã" : ROTULO_DIA[d.dow];
  return `${dia} às ${hhmm(d.hora * 60 + d.minuto)}`;
}

export const horaLondres = (iso: string) => {
  const d = emLondres(new Date(iso));
  return hhmm(d.hora * 60 + d.minuto);
};
