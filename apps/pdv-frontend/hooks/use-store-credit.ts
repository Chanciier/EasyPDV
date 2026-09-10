import { useMutation, useQuery } from '@tanstack/react-query'
import type { Customer } from '@easypdv/shared-types'
import { apiRequest } from '@/lib/api-client'

export interface StoreCreditGrantItemInput {
  productId: string
  quantity: number
  discountAmount: number
  restock: boolean
}

export interface GrantStoreCreditResult {
  grantId: string
  totalAmount: number
  balance: number
  items: {
    productSku: string
    productName: string
    quantity: number
    unitPrice: number
    discountAmount: number
    totalAmount: number
    restock: boolean
  }[]
}

/** Consultado no portão de CPF da tela de Vale-Troca — decide se pede nome+telefone (CPF novo) ou segue direto. */
export function useStoreCreditCustomer(document: string | null) {
  return useQuery({
    queryKey: ['store-credit', 'customer', document ?? ''],
    queryFn: () => apiRequest<{ found: boolean; customer: Customer | null }>(`/store-credit/customer/${document}`),
    enabled: !!document,
  })
}

/** Fase 3 (2026-09-10) — portão de CPF de uma venda normal e passo "Vale-Troca" do pagamento. `balance: null` = não deu pra saber (terminal não ativado/rede indisponível) — nunca trata como bloqueio, só "sem saldo visível". */
export function useStoreCreditBalance(document: string | null) {
  return useQuery({
    queryKey: ['store-credit', 'balance', document ?? ''],
    queryFn: () => apiRequest<{ balance: number | null }>(`/store-credit/balance/${document}`),
    enabled: !!document,
  })
}

export function useGrantStoreCredit() {
  return useMutation({
    mutationFn: (input: {
      document: string
      customerName?: string
      customerPhone?: string
      items: StoreCreditGrantItemInput[]
    }) => apiRequest<GrantStoreCreditResult>('/store-credit/grants', { method: 'POST', body: input }),
  })
}
