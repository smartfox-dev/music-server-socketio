import { OpenAI } from 'openai'
import { config } from 'dotenv'
config()

const OpenAIService = new OpenAI({
  timeout: 30000,
  apiKey: process.env.AZURE_OPENAI_API_KEY ?? '',
  baseURL: `https://${process.env.AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_ID}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION}`,
  defaultHeaders: {
    'api-key': process.env.AZURE_OPENAI_API_KEY ?? '',
  },
})

export default OpenAIService
