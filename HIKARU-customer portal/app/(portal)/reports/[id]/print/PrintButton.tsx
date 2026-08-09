'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        background: '#b8930a',
        color: 'white',
        border: 'none',
        padding: '10px 20px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(184,147,10,0.4)',
      }}
    >
      🖨 PDFとして保存
    </button>
  )
}
