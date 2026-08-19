// ============================================================
// CONSOLE Browser TTS wrapper（System と同仕様・独立コード）
// ============================================================

export class BrowserTTS {
  speak(text: string, onEnd?: () => void): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.()
      return
    }
    window.speechSynthesis.cancel()
    const utter   = new SpeechSynthesisUtterance(text)
    utter.lang    = 'ja-JP'
    utter.rate    = 1.0
    utter.pitch   = 1.0
    utter.volume  = 1.0

    if (onEnd) {
      let called = false
      const fire = () => { if (!called) { called = true; onEnd() } }
      utter.onend   = fire
      utter.onerror = fire
      const maxWait = Math.max(4000, text.length * 130)
      setTimeout(fire, maxWait)
    }

    window.speechSynthesis.speak(utter)
  }

  stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  get isSpeaking(): boolean {
    if (typeof window === 'undefined') return false
    return window.speechSynthesis?.speaking ?? false
  }
}

export const browserTTS = new BrowserTTS()
