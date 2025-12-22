import { AssemblyAI } from 'assemblyai';
import dotenv from 'dotenv';
dotenv.config();

const assemblyai = new AssemblyAI({
    apiKey: process.env.ASSEMBLY_AI_API_KEY
  });

export default assemblyai;