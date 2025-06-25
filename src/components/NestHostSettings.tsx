import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Settings, Trash2, RotateCcw } from 'lucide-react';

interface NestHostSettingsProps {
  currentStatus: string;
  isUpdatingStatus: boolean;
  isRestarting: boolean;
  isDeleting: boolean;
  isDeletingEvent: boolean;
  isConnecting: boolean;
  onUpdateStatus: (status: 'open' | 'private' | 'closed') => Promise<void>;
  onRestart: () => Promise<void>;
  onDelete: () => Promise<void>;
  roomName: string;
}

export function NestHostSettings({
  currentStatus,
  isUpdatingStatus,
  isRestarting,
  isDeleting,
  isDeletingEvent,
  isConnecting,
  onUpdateStatus,
  onRestart,
  onDelete,
  roomName,
}: NestHostSettingsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const isAnyActionPending = isUpdatingStatus || isRestarting || isDeleting || isDeletingEvent || isConnecting;

  const handleDeleteClick = () => {
    setIsDropdownOpen(false);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteDialog(false);
    await onDelete();
  };

  const handleRestartClick = async () => {
    setIsDropdownOpen(false);
    await onRestart();
  };

  const handleStatusChange = async (status: 'open' | 'private' | 'closed') => {
    setIsDropdownOpen(false);
    await onUpdateStatus(status);
  };

  return (
    <>
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            disabled={isAnyActionPending}
            className="text-primary border-primary hover:bg-primary/10"
          >
            <Settings className="h-4 w-4" />
            <span className="sr-only">Host Settings</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {/* Status Settings */}
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Nest Status
          </div>
          <DropdownMenuItem 
            onClick={() => handleStatusChange('open')}
            disabled={currentStatus === 'open' || isAnyActionPending}
            className="flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            Open
            {currentStatus === 'open' && (
              <span className="ml-auto text-xs text-muted-foreground">Current</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleStatusChange('private')}
            disabled={currentStatus === 'private' || isAnyActionPending}
            className="flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            Private
            {currentStatus === 'private' && (
              <span className="ml-auto text-xs text-muted-foreground">Current</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleStatusChange('closed')}
            disabled={currentStatus === 'closed' || isAnyActionPending}
            className="flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-red-500" />
            Closed
            {currentStatus === 'closed' && (
              <span className="ml-auto text-xs text-muted-foreground">Current</span>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Actions */}
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Actions
          </div>
          <DropdownMenuItem 
            onClick={handleRestartClick}
            disabled={isAnyActionPending}
            className="flex items-center gap-2 text-emerald-600 focus:text-emerald-600"
          >
            <RotateCcw className="h-4 w-4" />
            {isRestarting ? 'Restarting...' : 'Restart Nest'}
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={handleDeleteClick}
            disabled={isAnyActionPending}
            className="flex items-center gap-2 text-red-600 focus:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            {(isDeleting || isDeletingEvent) ? 'Deleting...' : 'Delete Nest'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Nest</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{roomName}"? This action cannot be undone and will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Remove the nest from all relays</li>
                <li>Disconnect all participants</li>
                <li>Delete the audio room permanently</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete Nest
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}