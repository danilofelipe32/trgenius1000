import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// FIX: Initialize with API key from environment variables per guidelines, removing hardcoded key.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Optimization variables ---
let lastApiCallTimestamp = 0;
const RATE_LIMIT_MS = 3000; // 3 second delay between calls
const CACHE_PREFIX = 'gemini-cache-';
// -----------------------------

export async function callGemini(prompt: string, useWebSearch: boolean = false): Promise<string> {
  // --- Rate Limiting Logic ---
  const now = Date.now();
  if (now - lastApiCallTimestamp < RATE_LIMIT_MS) {
    console.log("Rate limit triggered.");
    return "Erro: Múltiplas solicitações detectadas. Por favor, aguarde alguns segundos antes de tentar novamente.";
  }
  // ---------------------------

  // --- Caching Logic (Read) ---
  const cacheKey = `${CACHE_PREFIX}${useWebSearch}-${prompt}`;
  try {
    const cachedResponse = sessionStorage.getItem(cacheKey);
    if (cachedResponse) {
      console.log("Servindo resposta do cache.");
      return cachedResponse;
    }
  } catch (e) {
    console.warn("Não foi possível aceder ao sessionStorage para cache.", e);
  }
  // ----------------------------

  lastApiCallTimestamp = now; // Update timestamp only when making a real call

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      ...(useWebSearch && { config: { tools: [{ googleSearch: {} }] } }),
    });

    let text = response.text;
    
    if (response.candidates && response.candidates[0] && response.candidates[0].finishReason === 'SAFETY') {
      return "Erro: A resposta foi bloqueada devido a configurações de segurança. O seu prompt pode conter conteúdo sensível.";
    }

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (useWebSearch && groundingChunks && groundingChunks.length > 0) {
      const sources = (groundingChunks as any[])
        .map((chunk) => chunk.web)
        .filter((web): web is { uri: string; title?: string } => !!web && !!web.uri)
        .map((web) => {
          let displayTitle = web.title;
          // Se não houver título, cria um mais limpo a partir do URI.
          if (!displayTitle) {
            try {
              const url = new URL(web.uri);
              // Cria um título mais limpo a partir do nome do anfitrião, o que é melhor do que o URL longo completo.
              displayTitle = url.hostname.replace(/^www\./, '');
            } catch (e) {
              // Recorre ao URI original se não for um URL válido para análise.
              displayTitle = web.uri;
            }
          }
          return { title: displayTitle, uri: web.uri };
        });
      
      const uniqueSources = Array.from(new Map(sources.map(item => [item.uri, item])).values());

      if (uniqueSources.length > 0) {
        // Formata as fontes como links Markdown para esconder URLs longos e melhorar a legibilidade.
        const sourcesText = uniqueSources
          .map((source, index) => `${index + 1}. [${source.title}](${source.uri})`)
          .join('\n');
        // Usa um título mais descritivo para a seção de fontes.
        text += `\n\n---\n**Fontes da Web:**\n${sourcesText}`;
      }
    }

    if (text) {
      // --- Caching Logic (Write) ---
      if (!text.startsWith("Erro:")) {
        try {
          sessionStorage.setItem(cacheKey, text);
          console.log("Resposta guardada em cache.");
        } catch (e) {
          console.warn("Não foi possível guardar a resposta no sessionStorage.", e);
        }
      }
      // -----------------------------
      return text;
    }
    
    return "Erro: A resposta da API não continha texto gerado. Verifique o seu prompt.";

    // FIX: Use unknown in catch and safely access error message.
  } catch (error: unknown) {
    console.error("Erro ao chamar a API Gemini:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('API key not valid')) {
        return `Erro: A chave de API fornecida não é válida. Verifique se a chave está correta e se a API Generative Language está ativada no seu projeto Google Cloud.`;
    }
    
    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        const retryMatch = errorMessage.match(/retryDelay": "(\d+\.?\d*)s"/);
        let retryMessage = "Por favor, tente novamente mais tarde.";
        if (retryMatch && retryMatch[1]) {
            const delay = Math.ceil(parseFloat(retryMatch[1]));
            retryMessage = ` Por favor, aguarde cerca de ${delay} segundos antes de tentar novamente.`;
        }
        return `Erro: Limite de utilização da API excedido (cota). Você fez muitas solicitações num curto espaço de tempo.${retryMessage} Se o problema persistir, verifique o seu plano de faturação da API Gemini.`;
    }

    return `Erro: Falha na comunicação com a API. Verifique a sua ligação à Internet. Detalhes: ${errorMessage}`;
  }
}