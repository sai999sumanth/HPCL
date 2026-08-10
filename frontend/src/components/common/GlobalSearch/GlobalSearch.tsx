import { IconSearch } from '@tabler/icons-react';
import { Input } from '../../../@/components/ui/input';

const GlobalSearch = () => {
    return (
      <>
        <div className="relative">
          <IconSearch stroke={1.5} className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search" className="pl-8 w-96" />
        </div>
      </>
    )
  }
  export default GlobalSearch;