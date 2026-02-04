
import FormData from 'form-data';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai:8000';

export interface FaceResult {
  embedding: number[];
  bbox: number[];
  det_score: number;
}

export async function extractFaces(imageBuffer: Buffer): Promise<FaceResult[]> {
  const form = new FormData();
  form.append('file', imageBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });

  try {
    const response = await fetch(`${AI_SERVICE_URL}/extract`, {
      method: 'POST',
      body: form as any, // Node fetch supports FormData but types might conflict
      headers: form.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.statusText}`);
    }

    const data = await response.json() as { error?: string; faces?: FaceResult[] };
    if (data.error) {
      throw new Error(`AI service error: ${data.error}`);
    }

    return data.faces || [];
  } catch (error) {
    console.error('Face extraction failed:', error);
    // Don't crash the worker, just return empty
    return [];
  }
}
