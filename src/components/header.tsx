import React from "react";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import { getStarCount } from "~/app/_actions/github";
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs'

export async function Header() {
  const starCount = await getStarCount();

  const formatStarCount = (count: number | null) => {
    if (!count) return "0";
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <header className="border-b-[3px] border-black">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-8">
        <Link href="/" className="flex items-center">
          <span className="text-xl font-semibold">
            <span className="text-black transition-colors duration-200 hover:text-gray-600">
              Git
            </span>
            <span className="text-orange-600 transition-colors duration-200 hover:text-orange-500">
              Podcast
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="https://api.gitpodcast.com"
            className="text-sm font-medium text-black transition-transform hover:translate-y-[-2px] hover:text-orange-600"
          >
            API
          </Link>
          <Link
            href="https://github.com/BandarLabs/gitpodcast"
            className="flex items-center gap-2 text-sm font-medium text-black transition-transform hover:translate-y-[-2px] hover:text-orange-600"
          >
            <FaGithub className="h-5 w-5" />
            GitHub
          </Link>
          <span className="flex items-center gap-1 text-sm font-medium text-black">
            <span className="text-amber-400">★</span>
            {formatStarCount(starCount)}
          </span>
          <UserButton></UserButton>
        </nav>
      </div>
    </header>
  );
}
