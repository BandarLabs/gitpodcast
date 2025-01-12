"use client";

import { useParams } from "next/navigation";
import MainCard from "~/components/main-card";
import Loading from "~/components/loading";
import { useDiagram } from "~/hooks/useDiagram";
import { ApiKeyDialog } from "~/components/api-key-dialog";
import { Button } from "~/components/ui/button";
import {
    Card,
    CardTitle,
    CardHeader
  } from "~/components/ui/card"
import { ApiKeyButton } from "~/components/api-key-button";
import React, { useRef, useState, useEffect } from 'react';

import {parseWebVTT, syncSubtitle} from "~/lib/utils";
import { useGlobalState } from "~/app/providers";

interface Subtitle {
    start: number;
    end: number;
    text: string;
  }


const Repo: React.FC = () =>  {
  const {audioLength, anotherVariable} = useGlobalState();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const params = useParams<{ username: string; repo: string }>();

  const {
    diagram,
    error,
    loading,
    lastGenerated,
    cost,
    isRegenerating,
    showApiKeyDialog,
    tokenCount,
    handleModify,
    handleRegenerate,
    handleCopy,
    handleApiKeySubmit,
    handleCloseApiKeyDialog,
    handleOpenApiKeyDialog,
    handleAudio,
    audioUrl,
    audioRef,
    subtitleUrl
  } = useDiagram(params.username, params.repo, audioLength, anotherVariable);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState("");
//   useEffect(() => {
//     console.log("anotherVariable has changed:", anotherVariable);
//   }, [anotherVariable]);

  useEffect(() => {
    async function fetchSubtitles() {
      const res = await fetch(subtitleUrl);
      const vtt = await res.text();
      setSubtitles(parseWebVTT(vtt));
    }

    fetchSubtitles();
  }, [subtitleUrl]);

  useEffect(() => {
    if (!videoRef.current) return;

    const handleTimeUpdate = () => {
      const time = videoRef?.current?.currentTime;

      if (!subtitles || subtitles.length === 0) {
        setCurrentSubtitle(''); // Clear the subtitle if subtitles are not loaded
        return;
      }

      const index = syncSubtitle(subtitles, time);
      if (
        index !== null &&
        index !== undefined &&
        index >= 0 &&
        index < subtitles.length &&
        subtitles[index] // Ensure the subtitle at the index is not undefined
      ) {
        setCurrentSubtitle(subtitles[index].text ?? '');
      } else {
        setCurrentSubtitle(''); // Clear the subtitle if the index is invalid
      }
    };

    videoRef.current.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      }
    };
  }, [subtitles]);

  return (
    <div className="flex min-h-screen flex-col items-center p-4">
      <div className="flex w-full justify-center pt-8">
        <MainCard
          isHome={false}
          username={params.username}
          repo={params.repo}
          showCustomization={!loading && !error}
          onModify={handleModify}
          onRegenerate={handleRegenerate}
          onCopy={handleCopy}
          lastGenerated={lastGenerated}
        />
      </div>
      <div className="mt-8 flex w-full flex-col items-center gap-8">
        {loading ? (
          <div className="mt-12">
            <Loading cost={cost} isModifying={!isRegenerating} />
          </div>
        ) : error ? (
          <div className="mt-12 text-center">
            <p className="max-w-4xl text-lg font-medium text-red-600">
              {error}
            </p>
            {error.includes("Rate limit") && (
              <p className="mt-2 text-sm text-gray-600">
                Rate limits: 1 request per minute, 5 requests per day
              </p>
            )}
            {error.includes("token limit") && (
              <div className="mt-8 flex flex-col items-center gap-2">
                <ApiKeyButton onClick={handleOpenApiKeyDialog} />
                <p className="mt-2 text-sm">Your key will not be stored</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex w-full justify-center">

              {audioUrl ? (
                <div className="flex w-full justify-center flex-col" style={{ maxWidth: "360px" }} >
                    <div>
                        <audio ref={videoRef} style={{ width: "100%" }} id="audioVideo" controls crossOrigin="anonymous">
                            <source src={audioUrl} type="audio/mpeg" />
                            {/* <track src={subtitleUrl} kind="subtitles" label="English" srcLang="en" default/> */}
                        </audio>
                    </div>
                    <div style={{ height: "300px" }}>
                        <div className="flex w-full justify-center px-2" >
                            <Card className=" mt-2" style={{ width: "100%" }}>
                                <CardHeader className="break-words" >
                                    <CardTitle className="break-words">{currentSubtitle}</CardTitle>
                                </CardHeader>
                            </Card>
                        </div>
                    </div>

                </div>

            ) : (

              <Button
                onClick={handleAudio}
                className="border-[3px] border-black bg-orange-400 px-4 py-2 text-black shadow-[4px_4px_0_0_#000000] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-orange-300"
              >
                Play Explanation Audio
              </Button>

            )}
          </div>
        )}

      </div>

      <ApiKeyDialog
        isOpen={showApiKeyDialog}
        onClose={handleCloseApiKeyDialog}
        onSubmit={handleApiKeySubmit}
        tokenCount={tokenCount}
      />
    </div>
  );
}

export default Repo;