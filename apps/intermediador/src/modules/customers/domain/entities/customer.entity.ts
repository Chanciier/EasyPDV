export interface CustomerProps {
  id: string;
  organizationId: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  whatsappConsentAt: Date | null;
  whatsappOptOutAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Customer {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly document: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly whatsappConsentAt: Date | null;
  readonly whatsappOptOutAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CustomerProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.name = props.name;
    this.document = props.document;
    this.phone = props.phone;
    this.email = props.email;
    this.whatsappConsentAt = props.whatsappConsentAt;
    this.whatsappOptOutAt = props.whatsappOptOutAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** Fase 3/4 (motor de lembrete/canal) consultam isto antes de qualquer disparo — nunca leem os timestamps direto. */
  get canReceiveWhatsapp(): boolean {
    return this.whatsappConsentAt !== null && this.whatsappOptOutAt === null;
  }
}
