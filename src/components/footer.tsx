import React from "react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t-[3px] border-black py-4 lg:px-8">
      <div className="container mx-auto flex h-8 max-w-4xl items-center justify-center">
        <span className="text-sm font-medium text-black">
          Copyright © {" "}
          <Link
            href="https://github.com/BandarLabs"
            className="text-orange-600 hover:underline"
          >
            @BandarLabs
          </Link>
        </span>
      </div>
    </footer>
  );
}
