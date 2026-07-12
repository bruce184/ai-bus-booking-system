"use client";

import { useEffect, useId, useRef, useState } from "react";
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
 * Dùng <datalist> native (ponytail: khỏi cần dropdown lib, tự có keyboard nav).
 */
export function LocationInput({ id, value, onChange, placeholder = "Nhập tỉnh/thành hoặc bến xe...", required = false }) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState([]);
  const debounceRef = useRef(null);

  useEffect(() => {
    const keyword = value.trim();

    debounceRef.current = window.setTimeout(async () => {
      if (keyword.length < 1) {
        setSuggestions([]);
        return;
      }
      try {
        const data = await graphqlRequest(AUTOCOMPLETE, { keyword });
        setSuggestions(data.autocompleteLocations ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 200);

    return () => window.clearTimeout(debounceRef.current);
  }, [value]);

  return (
    <>
      <input
        id={id}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
      />
      <datalist id={listId}>
        {suggestions.map((location) => (
          <option key={location.id} value={location.name}>
            {location.type === "STATION" ? "Bến xe" : "Tỉnh/thành"}
          </option>
        ))}
      </datalist>
    </>
  );
}
