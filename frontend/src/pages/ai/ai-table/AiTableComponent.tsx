import React from "react";

const AiTableComponent = ({ data = [] }) => {
  if (data?.length === 0) {
    return <p className="text-gray-500 text-lg mt-4">No records found.</p>;
  }

  // Get table headers
  const keys = Object.keys(data[0]);

  return (
    <div className="overflow-x-auto mt-4">
      <table className="table-auto border-collapse w-full text-left shadow-lg rounded-lg">
        <thead>
          <tr className="bg-blue-600 text-white">
            {keys.map((key) => (
              <th
                key={key}
                className="px-6 py-3 text-sm font-semibold tracking-wider text-center border-b border-gray-200"
              >
                {key.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data?.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`${
                rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
              } hover:bg-gray-100 transition duration-300`}
            >
              {keys?.map((key) => (
                <td
                  key={`${rowIndex}-${key}`}
                  className="px-6 py-4 text-sm text-gray-700 border-b border-gray-200 text-center"
                >
                  {row[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AiTableComponent;
