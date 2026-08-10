import React, { useState } from "react";
import AiTableComponent from "./ai-table/AiTableComponent";
import AiQueryComponent from "./ai-query/AiQueryComponent";
import AiChartComponent from "./ai-chart/AiChartComponent";
import { SkeletonCard } from "../custom-dashboard/charts/Skeleton";
import { apiClient } from "@/services/apiClient";
import { encryptPayload } from "@/configs/encryptFernet";

const AiContainer: React.FC = () => {
  const [inputQuery, setInputQuery] = useState("");
  const [aiResults, setAiResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleQueryApi = async () => {
    try {
      setIsLoading(true);
      let encryptedQuery = encryptPayload(inputQuery);
      const response = await apiClient.get(`/query/chat?query=${encryptedQuery}`);
      const data = response.data;
      if (data && data?.success && data?.data && data?.data?.length > 0) {
        setAiResults(data?.data);
      } else {
        setAiResults([]);
      }
    } catch (error) {
      console.error("Error fetching options:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full mx-auto p-1 bg-white shadow-md rounded-lg">
      <AiQueryComponent
        handleSubmit={handleQueryApi}
        setInputQuery={setInputQuery}
        inputQuery={inputQuery}
        isLoading={isLoading}
        resetHandlerClicked={() => setAiResults([])}
      />
      {isLoading ? (
        <SkeletonCard />
      ) : aiResults?.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="w-full h-full mb-4 md:mb-0">
            <AiChartComponent aiResults={aiResults} title={inputQuery} />
          </div>
          <div className="w-full h-full">
            <AiTableComponent data={aiResults} />
          </div>
        </div>
      ) : (
        <div className="text-center">
          It seems like we couldn't find anything matching your query. Try being
          more specific or using keywords.
        </div>
      )}
    </div>
  );
};

export default AiContainer;
