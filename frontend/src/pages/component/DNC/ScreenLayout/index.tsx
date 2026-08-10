import React, { useEffect, useState } from 'react';
import { ToolBar } from './components/ToolBar';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { Groups } from '@/types/groups';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/@/components/ui/dialog';
import { Button } from '@/@/components/ui/button';
import { Label } from '@/@/components/ui/label';
import { Input } from '@/@/components/ui/input';
import { useLayoutStore } from '@/redux/features/useLayoutStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/@/components/ui/card';
import { Briefcase, Calculator, Clock, Cylinder, Fuel, LucideIcon, Users, Video, VideoIcon } from 'lucide-react';
import { cn } from '@/@/lib/utils';
import { apiClient } from '@/services/apiClient';

interface VideoCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  isSelected: boolean;
  onClick: () => void;
  participants?: string;
  duration?: string;
  quality?: string;
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  isSelected: boolean;
  onClick: () => void;
  isNew?: boolean;
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
  isSelected,
  onClick,
  isNew,
}: FeatureCardProps) {
  return (
    <Card
      className={cn(
        "relative cursor-pointer transition-all hover:shadow-lg",
        isSelected
          ? "border-2 border-blue-500 shadow-lg"
          : "hover:border-muted-foreground/50"
      )}
      onClick={onClick}
    >
      <CardHeader className="p-3">
        <div className="flex flex-row items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <Icon className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      {/* <CardContent>
        {isSelected && (
          <div className="absolute bottom-4 right-4 h-6 w-6 rounded-full bg-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary-foreground"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </CardContent> */}
    </Card>
  );
}

export function VideoCard({
  title,
  description,
  icon: Icon,
  isSelected,
  onClick,
  participants,
  duration,
  quality,
}: VideoCardProps) {
  return (
    <Card
      className={cn(
        "relative cursor-pointer transition-all hover:shadow-lg",
        isSelected
          ? "border-2 border-blue-500 shadow-lg"
          : "hover:border-muted-foreground/50"
      )}
      onClick={onClick}
    >
      <CardHeader className="p-3">
        <div className="flex flex-row items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <Icon className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      {/* <CardContent className="p-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{participants}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{duration}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <VideoIcon className="h-4 w-4" />
            <span>{quality}</span>
          </div>
        </div>
        {isSelected && (
          <div className="absolute bottom-4 right-4 h-6 w-6 rounded-full bg-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary-foreground"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </CardContent> */}
    </Card>
  );
}


const ScreenLayout = () => {
  const [groups, setGroups] = useState<Groups[]>([])
  const { isModalOpen, addWidget } = useLayoutStore();
  const [selectedFeature, setSelectedFeature] = useState<any | null>(null);

  const features: any = [
    {
      id: "34",
      title: "Video Meeting",
      description: "Start or join a secure video call with HD quality",
      icon: Video,
      participants: "Up to 100 participants",
      duration: "60 minutes",
      quality: "HD Video & Audio",
    },
    {
      id: "35",
      title: "LPG",
      description: "Create a List view using tracks from any location",
      icon: Fuel,
      isNew: true,
    },
    {
      id: "36",
      title: "RO Report",
      description: "See tasks that have time tracking enabled",
      icon: Clock,
    }
  ] as const;
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiClient.get(
          "/api/dashboardgroups",
        );
        const response = await res.data;
        if(response?.count > 0) {
          setGroups(response?.data);
        }
      } catch (error) {
        console.log(error);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = () => {
    if (selectedFeature) {
      console.log("Selected feature:", selectedFeature);
      // You can handle the selected feature here
      // alert(`You selected: ${features.find(f => f.id === selectedFeature)?.title}`);
      useLayoutStore.getState().addWidget(selectedFeature, null);
      console.log("", addWidget);
    }
  };

  return (
    <React.Fragment>
      <div className="flex flex-col h-screen">
        <ToolBar groups={groups} />
        <div className="flex flex-1 overflow-hidden">
          <Canvas className="overflow-auto" />
          <Sidebar widgets={groups} />
        </div>
      </div>


      <Dialog open={isModalOpen} onOpenChange={useLayoutStore.getState().openModal}>
        <DialogContent className="sm:max-w-[425px] md:max-w-[728px] lg:max-w-[996px]">
          <DialogHeader>
            <DialogTitle>Add Custom Widget</DialogTitle>
          </DialogHeader>
          <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature: any, index) => (
              index === 0 ? (
                <VideoCard
                  key={feature.id}
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                  isSelected={selectedFeature === feature.id}
                  onClick={() => setSelectedFeature(feature)}
                  participants={feature.participants}
                  duration={feature.duration}
                  quality={feature.quality}
                />
              ) : (
                <FeatureCard
                  key={feature.id}
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                  isSelected={selectedFeature === feature.id}
                  isNew={feature.isNew}
                  onClick={() => setSelectedFeature(feature)}
                />
              )
            ))}
          </div>
          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              size="lg"
              onClick={handleSubmit}
              disabled={!selectedFeature}
            >
              Continue with {selectedFeature ? features.find(f => f.id === selectedFeature)?.title : 'selected feature'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </React.Fragment>
  )
}

export default ScreenLayout;