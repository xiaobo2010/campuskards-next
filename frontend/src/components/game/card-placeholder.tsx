"use client";

import Image from "next/image";
import type { Card } from "@/types";

interface CardPlaceholderProps {
  card?: Card;
  isOwned?: boolean;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export default function CardPlaceholder({ card, onClick, className = "", children }: CardPlaceholderProps) {
  const initial = card?.name ? card.name.charAt(0) : "?";
  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center justify-center bg-zinc-800 text-zinc-500 font-bold text-2xl select-none cursor-pointer rounded-lg aspect-[2/3] relative overflow-hidden ${className}`}
    >
      {card?.image_url ? (
        <Image
          src={card.image_url}
          alt={card.name}
          fill
          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 200px"
          className="object-cover"
          loading="lazy"
        />
      ) : (
        <span className="text-4xl">{initial}</span>
      )}
      {children}
    </div>
  );
}
