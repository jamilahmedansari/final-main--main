import { jsPDF } from 'jspdf'
import type { PdfLetterData, PdfConfig, PdfResult, PdfTemplate } from './types'

const DEFAULT_MARGINS = {
  top: 25,
  right: 20,
  bottom: 25,
  left: 25,
}

const COLORS = {
  primary: '#1a1a2e',
  secondary: '#4a4a6a',
  accent: '#0284c7',
  text: '#333333',
  lightText: '#666666',
  border: '#e0e0e0',
  watermark: '#f0f0f0',
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function sanitizeText(text: string): string {
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

function drawLetterhead(doc: jsPDF, config: PdfConfig): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const margins = config.margins || DEFAULT_MARGINS

  doc.setFillColor(COLORS.primary)
  doc.rect(0, 0, pageWidth, 8, 'F')

  doc.setFontSize(18)
  doc.setTextColor(COLORS.primary)
  doc.setFont('helvetica', 'bold')
  doc.text('TALK-TO-MY-LAWYER', margins.left, 20)

  doc.setFontSize(9)
  doc.setTextColor(COLORS.lightText)
  doc.setFont('helvetica', 'normal')
  doc.text('Professional Legal Letter Services', margins.left, 26)

  doc.setDrawColor(COLORS.border)
  doc.setLineWidth(0.5)
  doc.line(margins.left, 32, pageWidth - margins.right, 32)

  return 40
}

function drawWatermark(doc: jsPDF): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setTextColor(COLORS.watermark)
  doc.setFontSize(60)
  doc.setFont('helvetica', 'bold')

  doc.text('DRAFT', pageWidth / 2, pageHeight / 2, {
    align: 'center',
    angle: 45,
  })

  doc.setTextColor(COLORS.text)
}

function drawFooter(doc: jsPDF, pageNumber: number, totalPages: number, referenceNumber?: string): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margins = DEFAULT_MARGINS

  doc.setDrawColor(COLORS.border)
  doc.setLineWidth(0.3)
  doc.line(margins.left, pageHeight - 20, pageWidth - margins.right, pageHeight - 20)

  doc.setFontSize(8)
  doc.setTextColor(COLORS.lightText)
  doc.setFont('helvetica', 'normal')

  if (referenceNumber) {
    doc.text(`Ref: ${referenceNumber}`, margins.left, pageHeight - 12)
  }

  doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth / 2, pageHeight - 12, { align: 'center' })

  doc.text(
    'This letter has been reviewed by a licensed attorney.',
    pageWidth - margins.right,
    pageHeight - 12,
    { align: 'right' }
  )
}

function addNewPage(doc: jsPDF, config: PdfConfig): number {
  doc.addPage()

  if (config.showWatermark) {
    drawWatermark(doc)
  }

  return (config.margins?.top || DEFAULT_MARGINS.top) + (config.showLetterhead ? 10 : 0)
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  const sanitized = sanitizeText(text)
  const paragraphs = sanitized.split('\n\n')
  const lines: string[] = []

  paragraphs.forEach((paragraph, index) => {
    if (index > 0) {
      lines.push('')
    }

    const paragraphLines = paragraph.split('\n')
    paragraphLines.forEach(line => {
      const wrappedLines = doc.splitTextToSize(line, maxWidth)
      lines.push(...wrappedLines)
    })
  })

  return lines
}

export function generateLetterPdf(data: PdfLetterData, config: PdfConfig = {}): PdfResult {
  try {
    const {
      template = 'legal-letter',
      showWatermark = data.isDraft ?? false,
      showLetterhead = true,
      pageSize = 'letter',
      margins = DEFAULT_MARGINS,
    } = config

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: pageSize,
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const contentWidth = pageWidth - margins.left - margins.right
    const maxY = pageHeight - margins.bottom - 25

    let yPosition = margins.top

    if (showWatermark) {
      drawWatermark(doc)
    }

    if (showLetterhead) {
      yPosition = drawLetterhead(doc, { ...config, margins })
    }

    doc.setFontSize(10)
    doc.setTextColor(COLORS.text)
    doc.setFont('helvetica', 'normal')

    const dateText = formatDate(data.approvedAt || data.createdAt)
    doc.text(dateText, margins.left, yPosition)
    yPosition += 12

    if (data.parties.recipient.name) {
      doc.setFont('helvetica', 'bold')
      doc.text(data.parties.recipient.name, margins.left, yPosition)
      yPosition += 5
      doc.setFont('helvetica', 'normal')

      if (data.parties.recipient.company) {
        doc.text(data.parties.recipient.company, margins.left, yPosition)
        yPosition += 5
      }

      if (data.parties.recipient.address) {
        const addressLines = data.parties.recipient.address.split('\n')
        addressLines.forEach(line => {
          doc.text(line, margins.left, yPosition)
          yPosition += 5
        })
      }
    }

    yPosition += 8

    if (data.title) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text(`Re: ${data.title}`, margins.left, yPosition)
      yPosition += 10
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
    }

    const contentLines = wrapText(doc, data.content, contentWidth)
    const lineHeight = 5
    let pageCount = 1

    contentLines.forEach(line => {
      if (yPosition > maxY) {
        pageCount++
        yPosition = addNewPage(doc, { ...config, margins, showWatermark, showLetterhead })
      }

      if (line === '') {
        yPosition += lineHeight / 2
      } else {
        doc.text(line, margins.left, yPosition)
        yPosition += lineHeight
      }
    })

    yPosition += 15

    if (yPosition > maxY - 30) {
      pageCount++
      yPosition = addNewPage(doc, { ...config, margins, showWatermark, showLetterhead })
    }

    doc.text('Sincerely,', margins.left, yPosition)
    yPosition += 15

    doc.setFont('helvetica', 'bold')
    doc.text(data.parties.sender.name, margins.left, yPosition)
    yPosition += 5
    doc.setFont('helvetica', 'normal')

    if (data.parties.attorney?.name) {
      doc.setFontSize(9)
      doc.setTextColor(COLORS.secondary)
      doc.text(`Prepared by: ${data.parties.attorney.name}`, margins.left, yPosition)
      yPosition += 4

      if (data.parties.attorney.firmName) {
        doc.text(data.parties.attorney.firmName, margins.left, yPosition)
        yPosition += 4
      }

      if (data.parties.attorney.barNumber) {
        doc.text(`Bar No.: ${data.parties.attorney.barNumber}`, margins.left, yPosition)
      }
    }

    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      drawFooter(doc, i, totalPages, data.referenceNumber || `TTML-${data.id.substring(0, 8).toUpperCase()}`)
    }

    const buffer = Buffer.from(doc.output('arraybuffer'))

    return {
      success: true,
      buffer,
      pageCount: totalPages,
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown PDF generation error'
    console.error('[PdfGenerator] Error:', errorMessage)

    return {
      success: false,
      error: errorMessage,
    }
  }
}

export function generateSimplePdf(title: string, content: string, isDraft: boolean = false): PdfResult {
  return generateLetterPdf(
    {
      id: `simple-${Date.now()}`,
      title,
      content,
      parties: {
        sender: { name: 'Talk-To-My-Lawyer' },
        recipient: { name: 'Recipient' },
      },
      createdAt: new Date().toISOString(),
      isDraft,
    },
    { showLetterhead: true, showWatermark: isDraft }
  )
}
