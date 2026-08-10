import React from "react";
import { Send, Sparkles } from "lucide-react";
import { IconSquareX } from "@tabler/icons-react";
import { Input } from "@/@/components/ui/input";
import { Button } from "@/@/components/ui/button";

import mockQueries from "../mockQueries.json";
import ai_animation_5 from "../../../assets/gif/ai_animation_5.gif";

const AiQueryComponent = ({
  handleSubmit = () => {},
  setInputQuery = (string: any) => {},
  inputQuery = "",
  isLoading = false,
  resetHandlerClicked = () => {},
}) => {
  const resetQuery = () => {
    setInputQuery("");
    resetHandlerClicked();
  };

  const filterSuggestions = (inputValue) => {
    if (!inputValue) return [];
    const suggestions = [...mockQueries];
    return suggestions.filter((suggestion) =>
      suggestion.toLowerCase().includes(inputValue.toLowerCase())
    );
  };

  const suggestions = filterSuggestions(inputQuery);

  return (
    <div className="flex items-center space-x-2 mb-4">
      <div className="flex w-full items-center">
        <img src={ai_animation_5} alt="AI Animation" className="w-7 h-7 mr-1" />

        <div className="flex-grow flex items-center space-x-1 relative">
          <Sparkles
            className="absolute left-3 z-10 text-gray-400"
            style={{ width: 17, height: 17 }}
          />
          <Input
            className="pl-8 pr-10 py-1 w-full rounded-full bg-white-100 placeholder-gray-500 text-gray-700 focus:outline-none"
            style={{ height: "30px" }}
            placeholder="Ask Novex / Search..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
          />

          {inputQuery && (
            <Button
              className="absolute right-8 bg-transparent text-gray-700 p-1 shadow-none rounded-full"
              onClick={resetQuery}
            >
              <IconSquareX
                stroke={2}
                style={{ width: 17, height: 17, color: "#0047AB" }}
              />
            </Button>
          )}

          <Button
            className="absolute right-1 bg-transparent text-gray-700 p-1 shadow-none rounded-full"
            onClick={handleSubmit}
            disabled={!inputQuery || isLoading}
          >
            <Send
              className="rotate-45 mr-2"
              style={{ width: 17, height: 17, color: "#67047A" }}
            />
          </Button>
          {!suggestions.includes(inputQuery) && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <SuggestionItem
                  key={index}
                  suggestion={suggestion}
                  onClick={() => setInputQuery(suggestion)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiQueryComponent;

const SuggestionItem = ({ suggestion, onClick }) => (
  <div
    className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
    onClick={onClick}
  >
    {suggestion}
  </div>
);
