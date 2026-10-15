import { useState } from "react";
import type { DiscoveryTitle } from "@/lib/discovery";

export function DiscoveryArtwork({ title }: { title: DiscoveryTitle }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={`discovery-art${title.imageLayout === "poster" ? " discovery-art-poster" : ""}`}
    >
      <div className="discovery-art-fallback" aria-hidden="true">
        <span>WATCH TOGETHER</span>
        <strong>{title.title}</strong>
        <span>{title.year || "A NIGHT AT THE MOVIES"}</span>
      </div>
      {title.image && !failed && (
        <img
          src={title.image}
          alt=""
          loading="lazy"
          decoding="async"
          width={640}
          height={title.imageLayout === "poster" ? 960 : 400}
          ref={(image) => {
            if (image?.complete && image.naturalWidth === 0) setFailed(true);
          }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
