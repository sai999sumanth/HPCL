export const fetchApiChartsUtils = async (
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
    setError: React.Dispatch<React.SetStateAction<string | null>>,
    setCharts: React.Dispatch<React.SetStateAction<any[]>>
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/charts");
      const data = await response.json();
      if (data.data) {
        setCharts(data.data);
      } else {
        throw new Error("Failed to fetch data");
      }
    } catch (error) {
      console.error("Error fetching API chart data:", error);
      setError("Failed to fetch API chart data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  