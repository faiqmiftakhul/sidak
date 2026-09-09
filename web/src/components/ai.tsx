import { createContext, useContext } from 'react'

/** Dorongan eksternal ke asisten Tanya AI SIDAK (dari kartu Bacaan, chip kontekstual). */
export interface AiDorongan {
  konteks?: string
  pertanyaan?: string
}

export const AiCtx = createContext<{ buka: (d?: AiDorongan) => void }>({ buka: () => {} })
export const useAi = () => useContext(AiCtx)