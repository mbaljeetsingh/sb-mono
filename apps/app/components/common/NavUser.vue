<script setup lang="ts">
import { computed } from "vue";
import { LogOut, User as UserIcon, ShieldCheck } from "lucide-vue-next";
import { Button } from "@sb/layer-ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@sb/layer-ui/components/ui/dropdown-menu";
import UserAvatar from "~/components/common/UserAvatar.vue";
import { useUserStore } from "~/stores/user";
import { useAuth } from "~/composables/useAuth";

const userStore = useUserStore();
const { signOut } = useAuth();

const profile = computed(() => userStore.currentUser?.profile);
const displayName = computed(
  () =>
    profile.value?.display_name || userStore.currentUser?.email || "Account",
);
const email = computed(
  () => profile.value?.email || userStore.currentUser?.email || "",
);
const role = computed(() => userStore.userRole);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        class="h-auto gap-2 rounded-full p-1"
        aria-label="Account menu"
      >
        <UserAvatar
          :name="profile?.display_name"
          :email="email"
          :src="profile?.avatar_url"
          :size="32"
        />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-56">
      <DropdownMenuLabel>
        <div class="flex flex-col gap-0.5">
          <span class="truncate text-sm font-medium">{{ displayName }}</span>
          <span v-if="email" class="truncate text-xs text-muted-foreground">{{
            email
          }}</span>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem as-child>
        <NuxtLink to="/profile" class="flex w-full items-center gap-2">
          <UserIcon class="h-4 w-4" />
          Profile
        </NuxtLink>
      </DropdownMenuItem>
      <DropdownMenuItem v-if="role === 'admin'" as-child>
        <NuxtLink to="/admin" class="flex w-full items-center gap-2">
          <ShieldCheck class="h-4 w-4" />
          Admin
        </NuxtLink>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem class="flex items-center gap-2" @select="signOut">
        <LogOut class="h-4 w-4" />
        Sign out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
