const Skeleton = ({ className }) => (
    <div aria-live="polite" aria-busy="true" className={className}>
      <span className="inline-flex w-full animate-pulse select-none rounded-md bg-gray-300 leading-none">
        ‌
      </span>
      <br />
    </div>
  )
  
  const SVGSkeleton = ({ className }) => (
    <svg
      className={
        className + " animate-pulse rounded bg-gray-300"
      }
    />
  )

  const SkeletonCard: React.FC = () => (
    <div className="skeleton-card p-4 bg-gray-200 rounded-lg">
      <div className="h-4 bg-gray-300 mb-2 rounded"></div>
      <div className="h-4 bg-gray-300 w-1/2 rounded"></div>
    </div>
  );
  
  export { Skeleton, SVGSkeleton, SkeletonCard }