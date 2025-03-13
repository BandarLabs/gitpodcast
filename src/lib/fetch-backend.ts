import {
  cacheDiagramAndExplanation,
  getCachedDiagram,
  getCachedExplanation,
  getCachedAudioBase64,
  getCachedWebVtt,
  cacheAudioAndWebVtt
} from "~/app/_actions/cache";

function blobToBuffer(blob: Blob): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const buffer = Buffer.from(arrayBuffer);
        resolve(buffer);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

// Convert audioBlob to base64
function b64encode(buffer: Buffer): string {
    return buffer.toString('base64');
  }

interface GenerateApiResponse {
  error?: string;
  diagram?: string;
  explanation?: string;
  token_count?: number;
  requires_api_key?: boolean;
}

interface ModifyApiResponse {
  error?: string;
  diagram?: string;
}

interface CostApiResponse {
  error?: string;
  cost?: string;
}
interface GenerateAudioResponse {
    error?: string;
    audioBlob?: Blob;
    vtt?: string;
 }
 interface GenerateSlideResponse {
    error?: string;
    slide_markdown?: string;
 }
 export async function generateAndCacheDiagram(
   username: string,
   repo: string,
   instructions?: string,
   api_key?: string,
   audio?: boolean
 ): Promise<GenerateApiResponse> {
   try {
     const baseUrl =
       process.env.NEXT_PUBLIC_API_DEV_URL ?? "https://api.gitpodcast.com";
     const url = new URL(`${baseUrl}/generate`);

     const response = await fetch(url, {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
         username,
         repo,
         instructions: instructions ?? "",
         api_key: api_key,
         audio: audio,
       }),
     });

     if (response.status === 429) {
       return { error: "Rate limit exceeded. Please try again later." };
     }

     const data = (await response.json()) as GenerateApiResponse;

     if (data.error) {
       return data; // pass the whole thing for multiple data fields
     }

     // Call the server action to cache the diagram
     await cacheDiagramAndExplanation(
       username,
       repo,
       data.diagram!,
       data.explanation!,
     );
     return { diagram: data.diagram };
   } catch (error) {
     console.error("Error generating diagram:", error);
     return { error: "Failed to generate diagram. Please try again later." };
   }
 }

 export async function generateSlide(
   username: string,
   repo: string,
   instructions: string,
   api_key?: string,
 ): Promise<GenerateSlideResponse> {
   try {
     // Determine if we should use the cache (90% probability)
     const useCache = Math.random() < 0.90;
     if (useCache) {
       try {
         // Check cache for slides
         const cachedSlide = await await getCachedWebVtt(username, repo + "|slide" );;
         if (cachedSlide) {
           console.info("Serving slides from cache.");
           return { slide_markdown: cachedSlide };
         }
       } catch (error) {
         console.error("Error fetching slides from cache:", error);
         // Handle the error appropriately, possibly return a fallback or rethrow
       }
     }

     const baseUrl =
       process.env.NEXT_PUBLIC_API_DEV_URL ?? "https://api.gitpodcast.com";
     const url = new URL(`${baseUrl}/generate/slide`);

     const response = await fetch(url, {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
       },
       credentials: "include",
       body: JSON.stringify({
         username,
         repo,
         instructions,
         api_key: api_key,
       }),
     });

     if (response.status === 429) {
       return { error: "Rate limit exceeded. Please try again later." };
     }

     if (!response.ok) {
       const errorData = await response.json();
       return { error: errorData.error || "Failed to generate slides" };
     }

     const slideResponse = await response.json();
     const slideMarkdown = slideResponse.slide_markdown;

     // Cache the generated slides
    //  await cacheSlide(username, repo, slideMarkdown);
     await cacheAudioAndWebVtt(
        username,
        repo + "|slide",
        'slide',
        slideMarkdown ?? '',
      );

     return { slide_markdown: slideMarkdown };
   } catch (error) {
     console.error("Error generating slides:", error);
     return { error: "Failed to generate slides. Please try again later." };
   }
 }

 export async function generateAudio(
    username: string,
   repo: string,
   audio_length: string,
   instructions?: string,
   api_key?: string,

 ): Promise<GenerateAudioResponse> {
   try {
        // Determine if we should use the cache (90% probability)
        const useCache = Math.random() < 0.90;
        if (useCache) {
            try{
                // First, check cache for base64 encoded audio and WebVTT
                // So as to not having to modify db, using repo + audio_length as repo name
                const cachedAudioBase64 = await getCachedAudioBase64(username, repo + "|" + audio_length);
                const cachedVtt = await getCachedWebVtt(username, repo + "|" + audio_length);

                if (cachedAudioBase64 && cachedVtt) {
                    console.info("Serving content from cache.");
                    // Convert the base64 audio back to a Blob
                    const cachedAudioBuffer = Buffer.from(cachedAudioBase64, 'base64');
                    const cachedAudioBlob = new Blob([cachedAudioBuffer], { type: 'audio/mpeg' });
                    return { audioBlob: cachedAudioBlob, vtt: cachedVtt };
                }
            } catch (error) {
                console.error("Error fetching from cache:", error);
                // Handle the error appropriately, possibly return a fallback or rethrow
            }
        }
      const baseUrl =
        process.env.NEXT_PUBLIC_API_DEV_URL ?? "https://api.gitpodcast.com";
      const url = new URL(`${baseUrl}/generate`);


      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username,
          repo,
          instructions: instructions ?? "",
          api_key: api_key,
          audio: true,
          audio_length: audio_length
        }),
      });

      if (response.status === 429) {
        return { error: "Rate limit exceeded. Please try again later." };
      }

      if (!response.ok) {
        const errorData = await response.json();
        return { error: errorData.error || "Failed to generate audio" };
      }

      const audioBlob = await response.blob();
      const audioBuffer = await blobToBuffer(audioBlob);
      const vttContent = response.headers.get("x-vtt-content");


      // Call the server action to cache the diagram
     await cacheAudioAndWebVtt(
        username,
        repo + "|" + audio_length,
        b64encode(audioBuffer),
        vttContent ?? '',
      );
      return { audioBlob:new Blob([audioBuffer], { type: 'audio/mpeg' }),  vtt: vttContent ?? '' };
    } catch (error) {
      console.error("Error generating audio:", error);
      return { error: "Failed to generate audio. Please try again later." };
    }
 }

export async function modifyAndCacheDiagram(
  username: string,
  repo: string,
  instructions: string,
): Promise<ModifyApiResponse> {
  try {
    // First get the current diagram from cache
    const currentDiagram = await getCachedDiagram(username, repo);
    const explanation = await getCachedExplanation(username, repo);

    if (!currentDiagram || !explanation) {
      return { error: "No existing diagram or explanation found to modify" };
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_API_DEV_URL ?? "https://api.gitpodcast.com";
    const url = new URL(`${baseUrl}/modify`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        repo,
        instructions: instructions,
        current_diagram: currentDiagram,
        explanation: explanation,
      }),
    });

    if (response.status === 429) {
      return { error: "Rate limit exceeded. Please try again later." };
    }

    const data = (await response.json()) as ModifyApiResponse;

    if (data.error) {
      return { error: data.error };
    }

    // Call the server action to cache the diagram
    await cacheDiagramAndExplanation(
      username,
      repo,
      data.diagram!,
      explanation,
    );
    return { diagram: data.diagram };
  } catch (error) {
    console.error("Error modifying diagram:", error);
    return { error: "Failed to modify diagram. Please try again later." };
  }
}

export async function getCostOfGeneration(
  username: string,
  repo: string,
  instructions: string,
): Promise<CostApiResponse> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_DEV_URL ?? "https://api.gitpodcast.com";
    const url = new URL(`${baseUrl}/generate/cost`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        repo,
        instructions: instructions ?? "",
      }),
    });

    if (response.status === 429) {
      return { error: "Rate limit exceeded. Please try again later." };
    }

    const data = (await response.json()) as CostApiResponse;

    return { cost: data.cost, error: data.error };
  } catch (error) {
    console.error("Error getting generation cost:", error);
    return { error: "Failed to get cost estimate." };
  }
}
