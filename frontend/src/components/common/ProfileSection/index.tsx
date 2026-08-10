import { IconUserCircle } from '@tabler/icons-react';
import { Button } from '../../../@/components/ui/button';



const ProfileSection = () => {
  return (
    <>
    {/* <Button variant="outline" className='p-2'>
      <IconUserCircle stroke={1.5} color="#757575" />
    </Button> */}
    <Button variant="outline" className="px-2">
      <IconUserCircle stroke={1} />
    </Button>
    </>
  );
};

export default ProfileSection;
