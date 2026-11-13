'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer, AlertTriangle, Clock, Phone, Mail, MapPin, Globe, User } from 'lucide-react'
import type { Organization, Quote } from '@/types/database'
import { deriveQuoteStatus, formatCurrency, formatDate, formatQuantity, parseStoreAddress } from '@/lib/utils'

interface QuotePrintableDocProps {
  quote: Quote
  organization: Organization
  previewMode?: boolean
}

/**
 * Paginação por FLUXO, não por contagem fixa de itens:
 * - o conteúdo é uma tabela de uma coluna; o thead/tfoot com espaçadores se
 *   repetem em cada folha impressa (respiro do timbrado);
 * - o papel timbrado é uma imagem `position: fixed` que o navegador repinta em
 *   cada página;
 * - nada de max-height/overflow hidden: descrição ou observação longa quebra a
 *   página em vez de ser cortada.
 * Limitação real: a repetição do fundo depende do motor de impressão; sem teste
 * visual aprovado não se afirma o contrário.
 */
export function QuotePrintableDoc({ quote, organization, previewMode = false }: QuotePrintableDocProps) {
  const status = deriveQuoteStatus(quote)
  const isDraft = status === 'draft'
  const isCancelled = status === 'cancelled'
  const isExpired = status === 'expired'
  const showPreview = previewMode || isDraft

  const items = [...(quote.items ?? [])].sort((a, b) => a.position - b.position)

  // Snapshots e perfil do vendedor (1ª coluna)
  const sellerName = quote.seller_name_snapshot || quote.seller?.full_name || 'Administrador do Sistema'
  const sellerPhone = quote.seller_phone_snapshot || quote.seller?.phone || organization.contact_phone || '(11) 99999-0000'
  const sellerEmail = quote.seller?.email || organization.contact_email || 'admin@orcamentos.com'

  // Dados da loja (2ª coluna)
  const emailDomain = organization.contact_email?.includes('@')
    ? organization.contact_email.split('@')[1]
    : null
  const isGenericEmail = Boolean(
    emailDomain &&
      ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com'].includes(
        emailDomain.toLowerCase()
      )
  )
  const storeWebsite = !isGenericEmail && emailDomain
    ? `www.${emailDomain}`
    : 'www.repalmarechal.com.br'

  const storePhone = organization.contact_phone || '(41) 3333-3692'
  const storeEmail = organization.contact_email || 'contato@repalmarechal.com.br'

  // Endereço da loja (3ª coluna: Rua/número/bairro, Município/Estado, CEP)
  const storeAddress = parseStoreAddress(organization.address)

  const brand = organization.brand_primary_color || '#1e40af'
  const secondary = organization.brand_secondary_color || '#3b82f6'

  const title = isDraft
    ? 'Prévia de Proposta Comercial'
    : isCancelled
      ? 'Orçamento Cancelado'
      : isExpired
        ? 'Proposta Comercial (expirada)'
        : 'Orçamento Oficial de Venda'

  return (
    <div className="w-full min-h-screen bg-slate-200/70 py-6 px-2 sm:px-4 print:bg-white print:p-0 print:m-0 print:min-h-0">
      <div className="no-print mx-auto max-w-[210mm] mb-6 flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-300/80">
        <Link
          href={`/orcamentos/${quote.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao orçamento
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          {showPreview && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              <Clock className="h-3.5 w-3.5" />
              Prévia interna
            </span>
          )}
          {isCancelled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              Cancelado — sem valor comercial
            </span>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white shadow hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            style={{ backgroundColor: brand }}
          >
            <Printer className="h-4 w-4" />
            Imprimir / Salvar em PDF
          </button>
        </div>

        <p className="w-full text-[11px] text-slate-500">
          Documento interno. O link de impressão exige login e não é uma página pública.
        </p>
      </div>

      <section
        aria-label="Documento para impressão"
        className="timbrado-sheet relative mx-auto bg-white shadow-2xl text-slate-900 print:shadow-none"
        style={{ width: '210mm', minHeight: '297mm' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- timbrado precisa sair sem otimização */}
        <img
          src="/timbrado-repal-2.png?v=3"
          alt=""
          aria-hidden="true"
          className="timbrado-letterhead absolute top-0 left-0 pointer-events-none"
          style={{ width: '210mm', height: '297mm', objectFit: 'cover', zIndex: 0 }}
        />

        <table className="timbrado-flow relative" style={{ width: '174mm', margin: '0 auto', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <td>
                {/* Respiro superior repetido em cada folha impressa. */}
                <div style={{ height: '38mm' }} />
              </td>
            </tr>
          </thead>
          <tfoot>
            <tr>
              <td>
                {/* Respiro inferior repetido em cada folha impressa. */}
                <div style={{ height: '46mm' }} />
              </td>
            </tr>
          </tfoot>

          <tbody style={{ position: 'relative', zIndex: 1 }}>
            {isCancelled && (
              <tr className="page-break-inside-avoid">
                <td className="pb-3">
                  <div className="rounded-md border-2 border-red-600 bg-red-50 px-3 py-2 text-center">
                    <span className="text-sm font-black uppercase tracking-widest text-red-700">
                      Documento cancelado
                    </span>
                    <p className="text-[10px] text-red-700 mt-0.5">
                      Sem validade comercial
                      {quote.cancel_reason ? ` • Motivo: ${quote.cancel_reason}` : ''}
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {isExpired && (
              <tr className="page-break-inside-avoid">
                <td className="pb-3">
                  <div className="rounded-md border border-amber-400 bg-amber-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                    Proposta expirada em {quote.valid_until ? formatDate(quote.valid_until) : '—'}
                  </div>
                </td>
              </tr>
            )}

            <tr className="page-break-inside-avoid">
              <td>
                <header
                  className="border-b-2 pb-2 mb-3 flex items-end justify-between gap-3"
                  style={{ borderColor: brand }}
                >
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 block leading-tight">
                      {organization.display_name}
                      {organization.legal_name ? ` • ${organization.legal_name}` : ''}
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block leading-tight">
                      {title}
                    </span>
                    <h1 className="text-xl font-black tracking-tight text-slate-900 leading-tight">
                      Nº <span style={{ color: brand }}>{quote.quote_number || 'RASCUNHO'}</span>
                    </h1>
                  </div>

                  <div className="text-right text-[10px] text-slate-600 space-y-0.5">
                    <div>
                      <span className="font-semibold text-slate-500">Emissão: </span>
                      <span className="font-bold text-slate-900">
                        {formatDate(quote.issued_at || quote.created_at)}
                      </span>
                    </div>
                    {quote.valid_until && (
                      <div>
                        <span className="font-semibold text-slate-500">Validade: </span>
                        <span className="font-bold" style={{ color: brand }}>
                          {formatDate(quote.valid_until)}
                        </span>
                      </div>
                    )}
                  </div>
                </header>

                <section
                  className="mb-3 rounded-md border border-slate-200 bg-slate-50/90 p-2.5 text-[11px]"
                  style={{ borderColor: secondary }}
                >
                  <div className="font-bold uppercase tracking-wider text-slate-600 text-[9px] mb-1.5 border-b border-slate-200 pb-0.5">
                    Identificação do Cliente
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div>
                      <span className="text-slate-500 font-medium">Cliente / Razão Social: </span>
                      <span className="font-bold text-slate-900">{quote.customer_name}</span>
                    </div>
                    {quote.customer_tax_id && (
                      <div>
                        <span className="text-slate-500 font-medium">CPF / CNPJ: </span>
                        <span className="font-semibold text-slate-800">{quote.customer_tax_id}</span>
                      </div>
                    )}
                    {quote.customer_phone && (
                      <div>
                        <span className="text-slate-500 font-medium">Telefone: </span>
                        <span className="font-semibold text-slate-800">{quote.customer_phone}</span>
                      </div>
                    )}
                    {quote.customer_email && (
                      <div>
                        <span className="text-slate-500 font-medium">E-mail: </span>
                        <span className="font-semibold text-slate-800">{quote.customer_email}</span>
                      </div>
                    )}
                  </div>
                </section>
              </td>
            </tr>

            <tr className="page-break-inside-avoid">
              <td>
                <div
                  className="grid grid-cols-[10mm_1fr_18mm_24mm_24mm] items-center font-bold uppercase text-[9px] tracking-wider text-white px-2 py-1.5"
                  style={{ backgroundColor: '#0f172a' }}
                >
                  <span className="text-center">Item</span>
                  <span>Descrição do Produto / Serviço</span>
                  <span className="text-right">Qtd.</span>
                  <span className="text-right">Valor Unit.</span>
                  <span className="text-right">Total</span>
                </div>
              </td>
            </tr>

            {items.length > 0 ? (
              items.map((item, index) => (
                <tr key={item.id ?? index} className={index % 2 === 1 ? 'bg-slate-50/60' : ''}>
                  <td>
                    <div className="grid grid-cols-[10mm_1fr_18mm_24mm_24mm] items-start text-[11px] px-2 py-1.5 border-b border-slate-200">
                      <span className="text-center font-bold text-slate-500">{index + 1}</span>
                      <span className="font-semibold text-slate-900 leading-snug whitespace-pre-wrap break-words pr-2">
                        {item.description}
                      </span>
                      <span className="text-right text-slate-800 font-medium">
                        {formatQuantity(item.quantity)} {item.unit || 'un'}
                      </span>
                      <span className="text-right text-slate-800 font-mono">
                        {formatCurrency(item.unit_price_cents)}
                      </span>
                      <span className="text-right font-bold text-slate-900 font-mono">
                        {formatCurrency(item.line_total_cents)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td>
                  <div className="py-4 text-center text-slate-400 italic text-[11px]">
                    Nenhum item adicionado neste orçamento.
                  </div>
                </td>
              </tr>
            )}

            <tr className="page-break-inside-avoid">
              <td>
                <div className="flex justify-end pt-3">
                  <div
                    className="w-60 rounded border-2 bg-white p-2 space-y-1 shadow-sm text-[11px]"
                    style={{ borderColor: secondary }}
                  >
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-semibold font-mono">{formatCurrency(quote.subtotal_cents)}</span>
                    </div>
                    {quote.discount_cents > 0 && (
                      <div className="flex justify-between text-emerald-700 font-medium text-[10px]">
                        <span>
                          Desconto
                          {quote.subtotal_cents > 0
                            ? ` (${((quote.discount_cents / quote.subtotal_cents) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`
                            : ''}
                          :
                        </span>
                        <span className="font-mono">− {formatCurrency(quote.discount_cents)}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-900 pt-1 flex justify-between items-baseline font-black text-slate-900">
                      <span className="uppercase tracking-wider text-xs">Total:</span>
                      <span className="font-mono text-sm" style={{ color: brand }}>
                        {formatCurrency(quote.total_cents)}
                      </span>
                    </div>
                  </div>
                </div>
              </td>
            </tr>

            {quote.payment_terms && (
              <tr>
                <td className="pt-3">
                  <div className="rounded border border-slate-200 bg-slate-50/80 p-2 text-[11px]">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 block mb-0.5">
                      Condições de Pagamento
                    </span>
                    <p className="text-slate-800 whitespace-pre-line leading-relaxed break-words">
                      {quote.payment_terms}
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {quote.notes && (
              <tr>
                <td className="pt-2">
                  <div className="rounded border border-slate-200 bg-slate-50/80 p-2 text-[11px]">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 block mb-0.5">
                      Observações Gerais / Prazos
                    </span>
                    <p className="text-slate-700 whitespace-pre-line leading-relaxed break-words">
                      {quote.notes}
                    </p>
                  </div>
                </td>
              </tr>
            )}

            <tr className="page-break-inside-avoid">
              <td className="pt-4">
                <div className="grid grid-cols-2 gap-6 items-end text-xs pb-2">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      Vendedor Responsável
                    </div>
                    <div className="text-sm font-bold text-slate-900 leading-tight mt-0.5">
                      {sellerName ?? '—'}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="inline-block w-52 border-b border-slate-400 mb-1" />
                    <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">
                      De Acordo / Assinatura do Cliente
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* =========================================================================
            RODAPÉ OFICIAL SOBRE O TIMBRADO (REPAL 2)
            Posicionado exatamente sobre a faixa vermelha inferior
            3 colunas equilibradas (3 linhas de dados cada):
            1ª Vendedor: Nome / Telefone / Email
            2ª Loja: Telefone / Site / Email
            3ª Endereço loja: Rua, numero, bairro / Municipio,Estado / Cep
            ========================================================================= */}
        <footer
          className="timbrado-footer-overlay absolute bottom-0 left-0 w-[210mm] z-10 pointer-events-none flex items-center justify-center pb-[3mm]"
          style={{ height: '17.5mm' }}
        >
          <div className="w-[182mm] mx-auto grid grid-cols-[1fr_1.05fr_1.2fr] gap-3 items-center text-white">
            {/* 1ª coluna - Vendedor : Nome / Telefone / Email */}
            <div className="flex items-center gap-2.5 min-w-0 relative -top-[1.2mm]">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white shadow-2xs">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="font-extrabold truncate text-[10.5px] leading-tight tracking-tight"
                  title={sellerName}
                >
                  {sellerName}
                </div>
                <div
                  className="text-white/95 font-bold truncate text-[9px] leading-tight flex items-center gap-1 mt-0.5"
                  title={sellerPhone}
                >
                  <Phone className="h-2.5 w-2.5 shrink-0 opacity-90" />
                  <span>{sellerPhone}</span>
                </div>
                <div
                  className="text-white/95 font-bold truncate text-[8.5px] leading-tight flex items-center gap-1 mt-0.5"
                  title={sellerEmail}
                >
                  <Mail className="h-2.5 w-2.5 shrink-0 opacity-90" />
                  <span>{sellerEmail}</span>
                </div>
              </div>
            </div>

            {/* 2ª coluna - Loja : Telefone / Site / Email */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white shadow-2xs">
                <Globe className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="font-extrabold truncate text-[10.5px] leading-tight tracking-tight flex items-center gap-1"
                  title={`Loja: ${storePhone}`}
                >
                  <Phone className="h-2.5 w-2.5 shrink-0 opacity-90" />
                  <span>Loja: {storePhone}</span>
                </div>
                <div
                  className="text-white/95 font-bold truncate text-[9px] leading-tight flex items-center gap-1 mt-0.5"
                  title={storeWebsite}
                >
                  <Globe className="h-2.5 w-2.5 shrink-0 opacity-90" />
                  <span>{storeWebsite}</span>
                </div>
                <div
                  className="text-white/95 font-bold truncate text-[8.5px] leading-tight flex items-center gap-1 mt-0.5"
                  title={storeEmail}
                >
                  <Mail className="h-2.5 w-2.5 shrink-0 opacity-90" />
                  <span>{storeEmail}</span>
                </div>
              </div>
            </div>

            {/* 3ª coluna - Endereço loja : Rua, numero, bairro / Municipio,Estado / Cep */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white shadow-2xs">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="font-extrabold truncate text-[10.5px] leading-tight tracking-tight"
                  title={storeAddress.street}
                >
                  {storeAddress.street}
                </div>
                <div
                  className="text-white/95 font-bold truncate text-[9px] leading-tight mt-0.5"
                  title={storeAddress.cityState}
                >
                  {storeAddress.cityState}
                </div>
                <div
                  className="text-white/90 font-bold truncate text-[8.5px] leading-tight mt-0.5"
                  title={storeAddress.cep}
                >
                  {storeAddress.cep}
                </div>
              </div>
            </div>
          </div>
        </footer>
      </section>
    </div>
  )
}
