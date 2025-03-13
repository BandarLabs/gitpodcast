"use client";

import { useParams } from "next/navigation";
import MainCard from "~/components/main-card";
import Loading from "~/components/loading";
import { useDiagram } from "~/hooks/useDiagram";
import { ApiKeyDialog } from "~/components/api-key-dialog";

import {
    ReactFlow,
    useReactFlow,
    ReactFlowProvider,
    Background,
    BackgroundVariant,
    type Node,
    type NodeMouseHandler,
} from '@xyflow/react';

// we need to import the React Flow styles to make it work
import '@xyflow/react/dist/style.css';

import { Slide, SLIDE_WIDTH, SLIDE_HEIGHT, SLIDE_PADDING, type SlideData } from '~/components/slide-paginator';
import { Button } from "~/components/ui/button";
import {
    Card,
    CardTitle,
    CardHeader
} from "~/components/ui/card"
import { ApiKeyButton } from "~/components/api-key-button";
import React, { useRef, useState, useEffect, useMemo, useCallback, KeyboardEventHandler } from 'react';

import { parseWebVTT, syncSubtitle } from "~/lib/utils";
import { useGlobalState } from "~/app/providers";



const nodeTypes = {
    slide: Slide,
};

interface Subtitle {
    start: number;
    end: number;
    text: string;
}



const AUTO_PLAY_INTERVAL = 5000;

const Repo: React.FC = () => {
    const { audioLength, anotherVariable } = useGlobalState();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const params = useParams<{ username: string; repo: string }>();
    const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
    const [currentSubtitle, setCurrentSubtitle] = useState("");
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [duration, setDuration] = useState(10);
    const initialSlide = '01';
    const [currentSlide, setCurrentSlide] = useState(initialSlide);
    const { fitView } = useReactFlow();

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
        subtitleUrl,
        slides
    } = useDiagram(params.username, params.repo, audioLength, anotherVariable);


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
                const subtitle = subtitles[index];
                setCurrentSubtitle(subtitle.text ?? '');
                setDuration(subtitle.end - subtitle.start);
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

    const parsedSlides = slides.reduce(
        (acc, slideContent, index) => {
            const id = String(index + 1).padStart(2, '0'); // Generate an ID based on the index

            // Manually define navigation rules for simplicity
            let navigation: { left?: string; right?: string } = {};

            if (index > 0) {
                navigation.left = String(index).padStart(2, '0');
            }
            if (index < slides.length - 1) {
                navigation.right = String(index + 2).padStart(2, '0');
            }

            acc[id] = {
                ...navigation,
                source: slideContent,
            };
            // alert(acc);
            return acc;
        },
        {} as { [key: string]: { up?: string; down?: string; left?: string; right?: string; source: string } },
    );

    useEffect(() => {
        let intervalId: NodeJS.Timeout;
        if (isAutoPlaying) {
          intervalId = setInterval(() => {
            setCurrentSlide((prevSlide) => {
              const slide = parsedSlides[prevSlide];
              fitView({ nodes: [{ id: slide?.right ?? '01' }], duration: 150 });
              return slide?.right ?? '01';
            });

          }, AUTO_PLAY_INTERVAL);
        }

        return () => {
          if (intervalId) {
            clearInterval(intervalId);
          }
        };
      }, [isAutoPlaying, parsedSlides, fitView]);

    const handleKeyPress = useCallback<KeyboardEventHandler>(
        (event) => {
          const slide = parsedSlides[currentSlide];

          switch (event.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
            case 'ArrowDown':
            case 'ArrowRight':
              const direction = event.key.slice(5).toLowerCase();
              if (!slide) break;
              const target = slide[direction as 'left' | 'right' | 'up' | 'down'];

              if (target) {
                event.preventDefault();
                setCurrentSlide(target);
                fitView({ nodes: [{ id: target }], duration: 150 });
              }
          }
        },
        [currentSlide, fitView, slides],
      );

    // Define slidesToElements using parsedSlides
    const slidesToElements = useCallback(() => {
        const start = Object.keys(parsedSlides)[0];
        const stack = [{ id: start, position: { x: 0, y: 0 } }];
        const visited = new Set();
        const nodes = [];
        const edges = [];

        while (stack.length) {
            const item = stack.pop();
            if (!item) continue;
            const { id, position } = item;
            const slide = parsedSlides[id ?? '01'];

            const node = {
                id: id ?? '01',
                type: 'slide',
                position,
                data: slide || { source: '' },
                draggable: false,
            } satisfies Node<SlideData>;

            if (slide && slide.left && !visited.has(slide.left)) {
                const nextPosition = {
                    x: position.x - (SLIDE_WIDTH + SLIDE_PADDING),
                    y: position.y,
                };

                stack.push({ id: slide.left, position: nextPosition });
                edges.push({
                    id: `${id}->${slide.left}`,
                    source: id,
                    target: slide.left,
                });
            }

            if (slide && slide.up && !visited.has(slide.up)) {
                const nextPosition = {
                    x: position.x,
                    y: position.y - (SLIDE_HEIGHT + SLIDE_PADDING),
                };

                stack.push({ id: slide.up, position: nextPosition });
                edges.push({ id: `${id}->${slide.up}`, source: id, target: slide.up });
            }

            if (slide && slide.down && !visited.has(slide.down)) {
                const nextPosition = {
                    x: position.x,
                    y: position.y + (SLIDE_HEIGHT + SLIDE_PADDING),
                };

                stack.push({ id: slide.down, position: nextPosition });
                edges.push({
                    id: `${id}->${slide.down}`,
                    source: id,
                    target: slide.down,
                });
            }

            if (slide && slide.right && !visited.has(slide.right)) {
                const nextPosition = {
                    x: position.x + (SLIDE_WIDTH + SLIDE_PADDING),
                    y: position.y,
                };

                stack.push({ id: slide.right, position: nextPosition });
                edges.push({
                    id: `${id}->${slide.right}`,
                    source: id,
                    target: slide.right,
                });
            }

            nodes.push(node);
            visited.add(id);
        }

        return { start, nodes, edges };
    }, [parsedSlides]);



    const { start, nodes, edges } = useMemo(() => slidesToElements(), [slidesToElements]);

    const handleNodeClick = useCallback<NodeMouseHandler>(
        (_, node) => {
            fitView({ nodes: [{ id: node.id }], duration: 150 });
        },
        [fitView],
    );
    const toggleAutoPlay = () => {
        setIsAutoPlaying((prevIsAutoPlaying) => !prevIsAutoPlaying);
      };
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
                                <div style={{ height: "200px", maxHeight: "300px" }}>
                                    <div className="flex w-full justify-center " >
                                        <div className="relative mt-2 w-full">
                                            <Card className=" relative" style={{ width: "100%" }}>
                                                <CardHeader className="break-words" >
                                                    <CardTitle className="break-words">{currentSubtitle}</CardTitle>
                                                </CardHeader>
                                            </Card>

                                        </div>
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
            <div className="my-4">

                {slides.length > 0 && (
                <div className="my-4">
                    <Button
                        onClick={toggleAutoPlay}
                        className="border-[3px] border-black bg-blue-300 px-4 py-2 text-black shadow-[4px_4px_0_0_#000000] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-blue-200"
                    >
                        {isAutoPlaying ? 'Stop Slide-Show' : 'Start Slide-Show'}
                    </Button>
                </div>
            )}
            </div>
            <div style={{ width: '400px', height: '400px' }}>
                <ReactFlow

                    nodes={nodes}
                    nodeTypes={nodeTypes}
                    // fitView
                    minZoom={0.1}
                    zoomOnScroll={false}
                    // maxZoom={1.2}
                    // zoomOnScroll={false}
                    // zoomOnDoubleClick={false}
                    zoomOnPinch={false}
                    onKeyDown={handleKeyPress}
                    onNodeClick={handleNodeClick}
                >
                <Background
                    id="1"
                    gap={10}
                    color="#f1f1f1"
                    variant={BackgroundVariant.Lines}
                />
                 </ReactFlow>
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