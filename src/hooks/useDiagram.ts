import { useState, useEffect, useCallback, useRef } from "react";
import { getCachedDiagram } from "~/app/_actions/cache";
import { getLastGeneratedDate } from "~/app/_actions/repo";
import { useAuth } from '@clerk/nextjs'
import {
  generateAndCacheDiagram,
  modifyAndCacheDiagram,
  getCostOfGeneration,
  generateAudio,
  generateSlide,
} from "~/lib/fetch-backend";
import { exampleRepos } from "~/lib/exampleRepos";

function base64ToUtf8(base64String: string) {
    // Decode base64 to a binary string
    const binaryString = atob(base64String);

    // Convert the binary string to an array of character codes
    const charCodes = Array.from(binaryString).map((char) => char.charCodeAt(0));

    // Decode the array of character codes into a UTF-8 string
    return new TextDecoder('utf-8').decode(new Uint8Array(charCodes));
}


export function useDiagram(username: string, repo: string, audio_length: string, anotherVariable: string) {
  const [diagram, setDiagram] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [lastGenerated, setLastGenerated] = useState<Date | undefined>();
  const [cost, setCost] = useState<string>("");
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [audioUrl, setAudioUrl] = useState("");
  const [subtitleUrl, setSubtitleUrl] = useState("");
  const [slides, setSlides] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Use `useAuth()` to access the `getToken()` method
  const { getToken } = useAuth()


  const isExampleRepo = (repoName: string): boolean => {
    return Object.values(exampleRepos).some((value) =>
      value.includes(repoName),
    );
  };

  const handleModify = async (instructions: string) => {
    if (isExampleRepo(repo)) {
      setError("Example repositories cannot be modified.");
      return;
    }

    setLoading(true);
    setError("");
    setCost("");
    setIsRegenerating(false);
    try {
      const result = await modifyAndCacheDiagram(username, repo, instructions);
      if (result.diagram) {
        setDiagram(result.diagram);
        const date = await getLastGeneratedDate(username, repo);
        setLastGenerated(date ?? undefined);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (error) {
      console.error("Error modifying diagram:", error);
      setError("Failed to modify diagram. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

    const handleAudio = useCallback(async () => {
        setLoading(true);

        // Use `getToken()` to get the current session token
        const token = await getToken()
        setError("");
        try {
            const slidePromise = generateSlide(username, repo, audio_length, "");
            const audioResult = await generateAudio(username, repo, audio_length, "", token ?? undefined);

            if (audioResult.error) {
                setError(audioResult.error);
            } else if (audioResult.audioBlob) {
                const url = URL.createObjectURL(audioResult.audioBlob);
                setAudioUrl(url);
                console.log(audioResult.vtt);
                if (audioResult.vtt) {
                    // Decode the base64 content back to a text string

                    const decodedVtt = base64ToUtf8(audioResult.vtt);
                    console.log(decodedVtt);
                    // Create a Blob with the decoded VTT content
                    const vttBlob = new Blob([decodedVtt], { type: 'text/vtt' });

                    // Create a URL for the Blob
                    const vttUrl = URL.createObjectURL(vttBlob);

                    // Use the vttUrl as needed, e.g., setting it to a video element's track source
                    setSubtitleUrl(vttUrl);
                }
                audioRef.current?.load(); // Reload the audio element to display the player correctly
            }

            try {
                const slideResult = await slidePromise;
                if (slideResult.error) {
                    setError(slideResult.error);
                } else {
                    const slidesArray = slideResult.slide_markdown!.split('---'); // Assume slides are separated by '---'

                    setSlides(slidesArray.slice(3)); // Set the slides array
                    console.log('Slide generated successfully:', slidesArray);


                }
            } catch (slideError) {
                console.error("Error generating slide:", slideError);
                setError("Failed to generate slide. Please try again later.");
            }
        } catch (error) {
            console.error("Error generating audio:", error);
            setError("Failed to generate audio. Please try again later.");
        } finally {
            setLoading(false);
        }
    }, [username, repo, anotherVariable]); // Add dependencies

    useEffect(() => {
        void handleAudio();
    }, [handleAudio]); // Re-run the effect if handleAudio changes


  const handleRegenerate = async (instructions: string) => {
    if (isExampleRepo(repo)) {
      setError("Example repositories cannot be regenerated.");
      return;
    }

    setLoading(true);
    setError("");
    setCost("");
    setIsRegenerating(true);
    try {
      const costEstimate = await getCostOfGeneration(username, repo, "");

      if (costEstimate.error) {
        console.error("Cost estimation failed:", costEstimate.error);
        setError(costEstimate.error);
      }

      setCost(costEstimate.cost ?? "");

      const result = await generateAndCacheDiagram(
        username,
        repo,
        instructions,
      );
      if (result.error) {
        console.error("Diagram generation failed:", result.error);
        setError(result.error);
      } else if (result.diagram) {
        setDiagram(result.diagram);
        const date = await getLastGeneratedDate(username, repo);
        setLastGenerated(date ?? undefined);
      }
    } catch (error) {
      console.error("Error regenerating diagram:", error);
      setError("Failed to regenerate diagram. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(diagram);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
    }
  };

  const handleApiKeySubmit = async (apiKey: string) => {
    setShowApiKeyDialog(false);
    setLoading(true);
    setError("");

    try {
      const result = await generateAndCacheDiagram(username, repo, "", apiKey);
      if (result.error) {
        setError(result.error);
      } else if (result.diagram) {
        setDiagram(result.diagram);
        const date = await getLastGeneratedDate(username, repo);
        setLastGenerated(date ?? undefined);
      }
    } catch (error) {
      console.error("Error generating with API key:", error);
      setError("Failed to generate diagram with provided API key.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseApiKeyDialog = () => {
    setShowApiKeyDialog(false);
  };

  const handleOpenApiKeyDialog = () => {
    setShowApiKeyDialog(true);
  };

  return {
    diagram,
    error,
    loading,
    lastGenerated,
    cost,
    isRegenerating,
    handleModify,
    handleRegenerate,
    handleCopy,
    showApiKeyDialog,
    tokenCount,
    handleApiKeySubmit,
    handleCloseApiKeyDialog,
    handleOpenApiKeyDialog,
    handleAudio,
    audioUrl,
    audioRef,
    subtitleUrl,
    slides
  };
}