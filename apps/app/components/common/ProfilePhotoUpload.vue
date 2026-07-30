<script setup lang="ts">
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@sb/layer-ui/components/ui/avatar';
import { Button } from '@sb/layer-ui/components/ui/button';
import {
  Dropzone,
  useSupabaseUpload,
} from '@sb/layer-ui/components/ui/dropzone';
import { Label } from '@sb/layer-ui/components/ui/label';
import { Camera } from 'lucide-vue-next';
import { type PropType, computed } from 'vue';
import { compressImage } from '~/lib/image';
import { uploadProfilePhoto } from '~/lib/storage';

const props = defineProps({
  /**
   * Current avatar URL
   */
  modelValue: {
    // Nullable — profile.vue holds `string | null` (no avatar yet).
    type: String as PropType<string | null>,
    default: null,
  },
  /**
   * User ID for upload path
   */
  userId: {
    type: String,
    required: true,
  },
  /**
   * Fallback text for avatar (e.g., user initials)
   */
  fallbackText: {
    type: String,
    default: 'U',
  },
  /**
   * Whether the component is disabled
   */
  disabled: {
    type: Boolean,
    default: false,
  },
  /**
   * Whether upload is in progress
   */
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  'update:modelValue',
  'file-selected',
  'upload-complete',
  'error',
]);

// Initialize dropzone
const dropzone = useSupabaseUpload({
  bucketName: 'avatars',
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  maxFileSize: 2 * 1024 * 1024, // 2MB
  maxFiles: 1,
  cacheControl: 3600,
  upsert: false,
});

// Get the selected file preview or current avatar
const displayUrl = computed(() => {
  const files = dropzone.files.value;
  const firstFile = files[0];
  if (files.length > 0 && firstFile?.preview) {
    return firstFile.preview;
  }
  return props.modelValue;
});

const hasNewImage = computed(() => dropzone.files.value.length > 0);
const selectedFile = computed(() => dropzone.files.value[0] || null);
const isDisabled = computed(
  () => props.disabled || props.loading || dropzone.loading.value
);

/**
 * Upload the selected file and return the public URL
 */
const uploadPhoto = async () => {
  if (!selectedFile.value || !props.userId) {
    return null;
  }

  try {
    const compressed = await compressImage(selectedFile.value);
    const publicUrl = await uploadProfilePhoto(
      compressed,
      props.userId,
      props.modelValue
    );
    emit('upload-complete', publicUrl);
    return publicUrl;
  } catch {
    emit('error', 'Failed to upload profile image. Please try again.');
    return null;
  }
};

/**
 * Reset the component state
 */
const reset = () => {
  dropzone.setFiles([]);
  dropzone.setErrors([]);
};

/**
 * Remove the selected file
 */
const removeFile = () => {
  dropzone.setFiles([]);
};

// Expose methods and state
defineExpose({
  uploadPhoto,
  reset,
  removeFile,
  hasNewImage,
  selectedFile,
  isUploading: dropzone.loading,
});
</script>

<template>
  <div class="space-y-3">
    <Label class="text-sm font-medium">Profile Photo</Label>
    <div class="flex flex-col items-center gap-2">
      <!-- Dropzone wraps the avatar for click & drag support -->
      <!-- Dropzone's `class` prop is typed String, so pass one merged string
           rather than an object binding. -->
      <Dropzone
        :dropzone="dropzone"
        :class="`border-0! bg-transparent! p-0! cursor-pointer${isDisabled ? ' pointer-events-none opacity-60' : ''}`"
      >
        <div class="relative group">
          <Avatar
            :key="displayUrl ?? 'fallback'"
            class="size-32 transition-all duration-200"
            :class="[
              dropzone.isDragActive.value &&
                'ring-2 ring-primary ring-offset-2 ring-offset-background',
            ]"
          >
            <AvatarImage
              v-if="displayUrl"
              :src="displayUrl"
              alt="Profile image"
              class="object-cover"
            />
            <AvatarFallback class="uppercase text-muted-foreground text-2xl">
              {{ fallbackText }}
            </AvatarFallback>
          </Avatar>

          <!-- Camera overlay on hover -->
          <div
            class="absolute top-0 left-0 size-32 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <Camera class="size-6 text-white" />
          </div>

          <!-- Remove button when new image selected -->
          <Button
            v-if="hasNewImage && !isDisabled"
            variant="destructive"
            size="icon"
            class="absolute -top-1 -right-1 size-6 rounded-full z-10"
            @click.stop="removeFile"
          >
            <span class="text-xs">×</span>
          </Button>
        </div>
      </Dropzone>

      <!-- Show selected file name or hint text -->
      <p class="text-xs text-muted-foreground">
        <template v-if="hasNewImage">{{ selectedFile?.name }}</template>
        <template v-else>Click or drag to upload</template>
      </p>
    </div>
  </div>
</template>
