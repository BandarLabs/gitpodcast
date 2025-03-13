"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Progress } from "./ui/progress";

// Move the trio import and registration to a client-side only component
const LoadingAnimation = dynamic(() => import("./loading-animation"), {
  ssr: false,
});

const messages = [
  "Checking if its cached...",
  "Generating podcast...",
  "Analyzing repository...",
  "Prompting OpenAI...",
  "Inspecting file paths...",
  "It usually takes 30 seconds...",
  "Bribing Guest...",
  "Extracting relevant directories...",
  "Shoutout to GitDiagram for inspiration",
  "--Good things take time--",
  "So this must be really good..",
  "If tired you can leave the tab open...",
  "Please Come back after two minutes though...",
  "Almost ready...",
  "Just kidding!",
  "Please just give me the podcast...",
  "...NOW!",
  "guess not...",
];

interface LoadingProps {
  cost?: string;
  isModifying?: boolean;
}

const Loading = ({ cost, isModifying }: LoadingProps) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const seconds = isModifying ? 10 : 45;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prevIndex) => (prevIndex + 1) % messages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Reset progress when component mounts
  useEffect(() => {
    setProgress(0);
  }, []);

  // Handle progress animation
  useEffect(() => {
    let animationFrameId: number;

    // Start progress if we're modifying OR if we have a cost
    if (!isModifying && !cost) return;

    const startTime = Date.now();
    const duration = seconds * 1000;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const rawProgress = Math.min(elapsed / duration, 1);
      setProgress(rawProgress * 100);

      if (elapsed < duration) {
        animationFrameId = requestAnimationFrame(updateProgress);
      }
    };

    animationFrameId = requestAnimationFrame(updateProgress);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      setProgress(0);
    };
  }, [cost, seconds, isModifying]);

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <LoadingAnimation />
      {(cost ?? isModifying) && (
        <Progress value={progress} className="mt-4 h-[7px] w-[300px]" />
      )}
      <div className="mt-4 animate-fade-in-up text-lg">
        {messages[currentMessageIndex]}
      </div>
      {cost && (
        <div className="mt-4 animate-fade-in text-sm text-purple-500">
          Estimated cost: {cost}
        </div>
      )}
    </div>
  );
};

export default Loading;
