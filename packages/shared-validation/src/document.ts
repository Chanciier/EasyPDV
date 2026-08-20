/**
 * Validação de CPF ("CPF na nota", 2026-08-19) — usada tanto no frontend
 * (bloquear submit de um CPF obviamente errado antes de gastar uma chamada
 * de rede) quanto no backend (`AttachCustomerToSaleUseCase`, defesa em
 * profundidade — nunca confiar só na validação client-side). Nenhum campo
 * de documento no projeto tinha validação de formato antes disso.
 */

/** Remove tudo que não é dígito — aceita tanto "111.444.777-35" quanto "11144477735" como entrada. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Algoritmo padrão de dígito verificador de CPF (dois módulos 11
 * sucessivos). Rejeita sequências de dígito repetido (ex: "00000000000"),
 * que passariam no cálculo do dígito verificador mas nunca são CPFs reais.
 */
export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const calcCheckDigit = (base: string): number => {
    let sum = 0;
    let weight = base.length + 1;
    for (const char of base) {
      sum += Number(char) * weight;
      weight -= 1;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstCheck = calcCheckDigit(digits.slice(0, 9));
  const secondCheck = calcCheckDigit(digits.slice(0, 9) + String(firstCheck));
  return digits === digits.slice(0, 9) + String(firstCheck) + String(secondCheck);
}

/** "11144477735" -> "111.444.777-35" — usado no cupom impresso e como fallback de nome do contato Bling. */
export function formatCpf(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}
