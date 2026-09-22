"use client";

import { useEffect, useRef } from "react";
import { carregarLeaflet, LeafletCamada, LeafletMapa } from "@/lib/leaflet";

/**
 * Mapa de uma rota única: posição do veículo (origem) → destino, com o traçado
 * entre eles. Complementa o MapaFrota (que mostra a frota inteira); aqui o foco
 * é um atendimento só.
 *
 * Quando o backend devolve geometria real (provedor Google), `pontosRota` traz
 * a rota decodificada e ela é desenhada como linha cheia. No fallback local
 * (estimativa) não há geometria — então traçamos uma linha tracejada reta entre
 * origem e destino, deixando visível que é uma aproximação, não a rua exata.
 */

interface Props {
  origem: { lat: number; lng: number };
  destino: { lat: number; lng: number; nome?: string | null };
  /** Geometria real da rota (decodificada). Ausente → traça linha reta. */
  pontosRota?: [number, number][] | null;
}

function coordenadaValida(lat: unknown, lng: unknown): boolean {
  const a = Number(lat);
  const b = Number(lng);
  return (
    Number.isFinite(a) && Number.isFinite(b) &&
    a >= -90 && a <= 90 && b >= -180 && b <= 180 &&
    !(a === 0 && b === 0)
  );
}

function marcador(cor: string, letra: string) {
  return {
    html: `<div style="
             background:${cor};width:28px;height:28px;border-radius:50%;
             border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);
             display:flex;align-items:center;justify-content:center;
             color:#fff;font-size:12px;font-weight:700;">${letra}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  };
}

export function MapaRota({ origem, destino, pontosRota }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<LeafletMapa | null>(null);
  const camadasRef = useRef<LeafletCamada[]>([]);
  const dadosRef = useRef({ origem, destino, pontosRota });
  dadosRef.current = { origem, destino, pontosRota };

  // Cria o mapa uma vez; destrói ao sair. (Mesmo cuidado de ciclo de vida do
  // MapaFrota: o Leaflet guarda estado no DOM e o Strict Mode remonta.)
  useEffect(() => {
    let cancelado = false;
    carregarLeaflet()
      .then((L) => {
        if (cancelado || !divRef.current || mapaRef.current) return;
        const mapa = L.map(divRef.current).setView([origem.lat, origem.lng], 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(mapa);
        mapaRef.current = mapa;
        setTimeout(() => mapaRef.current?.invalidateSize(), 0);
        desenhar();
      })
      .catch(() => {
        /* sem mapa: o painel de ETA ao lado continua útil */
      });
    return () => {
      cancelado = true;
      camadasRef.current = [];
      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redesenha quando a rota muda (outro atendimento selecionado).
  useEffect(() => {
    desenhar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origem.lat, origem.lng, destino.lat, destino.lng, pontosRota]);

  function desenhar() {
    const L = (window as unknown as { L?: import("@/lib/leaflet").Leaflet }).L;
    const mapa = mapaRef.current;
    if (!L || !mapa) return;
    try {
      if (!mapa.getContainer().isConnected) return;
    } catch {
      return;
    }

    const { origem: o, destino: d, pontosRota: pts } = dadosRef.current;

    camadasRef.current.forEach((c) => {
      try {
        c.remove();
      } catch {
        /* já removida */
      }
    });
    camadasRef.current = [];

    const temOrigem = coordenadaValida(o.lat, o.lng);
    const temDestino = coordenadaValida(d.lat, d.lng);
    if (!temOrigem && !temDestino) return;

    // Traçado: geometria real (linha cheia) ou linha reta tracejada (fallback).
    if (pts && pts.length > 1) {
      const linha = L.polyline(pts, { color: "#1256b8", weight: 5, opacity: 0.8 }).addTo(mapa);
      camadasRef.current.push(linha);
    } else if (temOrigem && temDestino) {
      const reta = L.polyline(
        [
          [o.lat, o.lng],
          [d.lat, d.lng],
        ],
        { color: "#1256b8", weight: 3, opacity: 0.6, dashArray: "8 8" },
      ).addTo(mapa);
      camadasRef.current.push(reta);
    }

    if (temOrigem) {
      const m = L.marker([o.lat, o.lng], { icon: L.divIcon({ className: "", ...marcador("#1256b8", "V") }) });
      m.addTo(mapa).bindPopup("<strong>Veículo</strong> (posição atual)");
      camadasRef.current.push(m);
    }
    if (temDestino) {
      const m = L.marker([d.lat, d.lng], { icon: L.divIcon({ className: "", ...marcador("#b42318", "D") }) });
      m.addTo(mapa).bindPopup(`<strong>Destino</strong>${d.nome ? ` — ${d.nome}` : ""}`);
      camadasRef.current.push(m);
    }

    // Enquadra tudo o que há para mostrar.
    const limites: [number, number][] = [];
    if (pts && pts.length > 1) limites.push(...pts);
    if (temOrigem) limites.push([o.lat, o.lng]);
    if (temDestino) limites.push([d.lat, d.lng]);
    try {
      mapa.invalidateSize();
      if (limites.length === 1) mapa.setView(limites[0], 15);
      else if (limites.length > 1) mapa.fitBounds(limites, { padding: [50, 50], maxZoom: 16 });
    } catch {
      /* enquadramento é conveniência */
    }
  }

  return (
    <div
      ref={divRef}
      className="h-full w-full rounded-card border border-surface-border"
      style={{ minHeight: 420, zIndex: 0 }}
    />
  );
}
