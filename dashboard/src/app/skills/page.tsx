'use client';

import { useCallback, useState } from 'react';
import { useSkills, toggleSkill, uploadSkills } from '@/hooks/useSkills';
import { Zap, Upload, Check, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

export default function SkillsPage() {
  const { skills, isLoading, mutate } = useSkills();
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);
    try {
      const fileList = acceptedFiles as unknown as FileList;
      const result = await uploadSkills(fileList);
      toast.success(`Uploaded ${result.success?.length || 0} skills`);
      if (result.failed?.length > 0) {
        toast.error(`Failed to upload: ${result.failed.join(', ')}`);
      }
      mutate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }, [mutate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/javascript': ['.js'],
      'application/typescript': ['.ts'],
      'application/zip': ['.zip']
    }
  });

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    try {
      await toggleSkill(id, !currentEnabled);
      mutate();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Skills</h1>
        <p className="text-muted-foreground mt-1">Manage agent capabilities and upload custom skills</p>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
        {uploading ? (
          <p className="text-muted-foreground">Uploading...</p>
        ) : isDragActive ? (
          <p className="text-primary">Drop the files here...</p>
        ) : (
          <>
            <p className="font-medium mb-1">Drop skill files here, or click to browse</p>
            <p className="text-sm text-muted-foreground">Supports .js, .ts, and .zip files</p>
          </>
        )}
      </div>

      {/* Skills List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading skills...</div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Available Skills ({skills?.length || 0})</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skills?.map((skill: any) => (
              <div
                key={skill.id}
                className="bg-card border rounded-lg p-5 flex items-start justify-between"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${skill.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Zap className={`h-5 w-5 ${skill.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{skill.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{skill.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">v{skill.version}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggle(skill.id, skill.enabled)}
                  className={`p-2 rounded-lg transition-colors ${
                    skill.enabled
                      ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {skill.enabled ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
