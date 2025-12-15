export type PdfTemplate = 'legal-letter' | 'demand-letter' | 'cease-desist' | 'general'

export interface LetterParties {
  sender: {
    name: string
    address?: string
    phone?: string
    email?: string
  }
  recipient: {
    name: string
    address?: string
    company?: string
  }
  attorney?: {
    name?: string
    firmName?: string
    barNumber?: string
  }
}

export interface PdfLetterData {
  id: string
  title: string
  content: string
  parties: LetterParties
  createdAt: string
  approvedAt?: string
  letterType?: string
  isDraft?: boolean
  referenceNumber?: string
}

export interface PdfConfig {
  template?: PdfTemplate
  showWatermark?: boolean
  showLetterhead?: boolean
  pageSize?: 'letter' | 'a4'
  margins?: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

export interface PdfResult {
  success: boolean
  buffer?: Buffer
  error?: string
  pageCount?: number
}
