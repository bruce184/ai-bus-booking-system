"use client";

import { useEffect, useRef, useState } from "react";
import { graphqlRequest } from "../../lib/graphql";

const AUTOCOMPLETE = `
  query AutocompleteLocations($keyword: String!) {
    autocompleteLocations(keyword: $keyword) {
      id
      name
      type
    }
  }
`;

/**
 * Ô nhập điểm đi/điểm đến với autocomplete từ query autocompleteLocations.
 * Dùng dropdown tự render (thay cho <datalist> native) để list gợi ý đồng bộ
 * màu với giao diện và bỏ được mũi tân native; input vẫn gõ tay bình thường.
 */
export function LocationInput({ id, value, onChange, placeholder = "Nhập tỉnh/thành hoặc bến xe...", required = false }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const debounceRef = useRef(null);
  const latestRequestRef = useRef(0);
  const blurTimerRef = useRef(null);

  useEffect(() => {
    const keyword = value.trim();
    // Bump synchronously so an in-flight request for a previous keystroke is
    // recognized as stale as soon as this one starts, regardless of which
    // response actually arrives first over the network.
    const requestId = ++latestRequestRef.current;

    debounceRef.current = window.setTimeout(async () => {
      if (keyword.length < 1) {
        if (requestId === latestRequestRef.current) {
          setSuggestions([]);
        }
        return;
      }
      try {
        const data = await graphqlRequest(AUTOCOMPLETE, { keyword });
        if (requestId === latestRequestRef.current) {
          setSuggestions(data.autocompleteLocations ?? []);
        }
      } catch {
        if (requestId === latestRequestRef.current) {
          setSuggestions([]);
        }
      }
    }, 200);

    return () => window.clearTimeout(debounceRef.current);
  }, [value]);

  useEffect(() => () => window.clearTimeout(blurTimerRef.current), []);

  const pick = (name) => {
    onChange(name);
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (event) => {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter" && highlight >= 0) {
      event.preventDefault();
      pick(suggestions[highlight].name);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && suggestions.length > 0;

  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        value={value}
        onChange={(event) => { onChange(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimerRef.current = window.setTimeout(() => setOpen(false), 120); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
      />
      {showList ? (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 30,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            margin: 0,
            padding: "4px",
            listStyle: "none",
            background: "var(--surface, #ffffff)",
            border: "1px solid var(--line)",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
            maxHeight: "240px",
            overflowY: "auto"
          }}
        >
          {suggestions.map((location, index) => (
            <li
              key={location.id}
              role="option"
              aria-selected={index === highlight}
              onMouseDown={(event) => { event.preventDefault(); pick(location.name); }}
              onMouseEnter={() => setHighlight(index)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                padding: "8px 10px",
                borderRadius: "6px",
                cursor: "pointer",
                background: index === highlight ? "var(--brand-weak, #e8f3ec)" : "transparent",
                color: "var(--text)"
              }}
            >
              <span style={{ fontWeight: 600 }}>{location.name}</span>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                {location.type === "STATION" ? "Bến xe" : "Tỉnh/thành"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
