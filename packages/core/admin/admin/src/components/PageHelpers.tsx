import * as React from 'react';

import {
  EmptyStateLayout,
  EmptyStateLayoutProps,
  Flex,
  Icon,
  Loader,
  Main,
} from '@strapi/design-system';
import { useAPIErrorHandler, useNotification, useRBACProvider } from '@strapi/helper-plugin';
import { EmptyPermissions, ExclamationMarkCircle } from '@strapi/icons';
import { useIntl } from 'react-intl';

import { Permission } from '../../../shared/contracts/shared';
import { useCheckPermissionsQuery } from '../services/auth';

/* -------------------------------------------------------------------------------------------------
 * Loading
 * -----------------------------------------------------------------------------------------------*/
interface LoadingProps {
  /**
   * @default 'Loading content.'
   */
  children?: React.ReactNode;
}

/**
 * @public
 * @description A loading component that should be rendered as the page
 * whilst you load the content for the aforementioned page.
 */
const Loading = ({ children = 'Loading content.' }: LoadingProps) => {
  return (
    <Main height="100vh" aria-busy={true}>
      <Flex alignItems="center" height="100%" justifyContent="center">
        <Loader>{children}</Loader>
      </Flex>
    </Main>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Error
 * -----------------------------------------------------------------------------------------------*/
interface ErrorProps extends Partial<EmptyStateLayoutProps> {}

/**
 * @public
 * @description An error component that should be rendered as the page
 * when an error occurs.
 */
const Error = (props: ErrorProps) => {
  const { formatMessage } = useIntl();

  return (
    <Main height="100%">
      <Flex alignItems="center" height="100%" justifyContent="center">
        <EmptyStateLayout
          icon={<Icon as={ExclamationMarkCircle} width="10rem" />}
          content={formatMessage({
            id: 'anErrorOccurred',
            defaultMessage: 'Woops! Something went wrong. Please, try again.',
          })}
          {...props}
        />
      </Flex>
    </Main>
  );
};

/* -------------------------------------------------------------------------------------------------
 * NoPermissions
 * -----------------------------------------------------------------------------------------------*/
interface NoPermissionsProps extends Partial<EmptyStateLayoutProps> {}

/**
 * @public
 * @description A component that should be rendered as the page
 * when the user does not have the permissions to access the content.
 * This component does not check any permissions, it's up to you to decide
 * when it should be rendered.
 */
const NoPermissions = (props: NoPermissionsProps) => {
  const { formatMessage } = useIntl();

  return (
    <Main height="100%">
      <Flex alignItems="center" height="100%" justifyContent="center">
        <EmptyStateLayout
          icon={<EmptyPermissions width="10rem" />}
          content={formatMessage({
            id: 'app.components.EmptyStateLayout.content-permissions',
            defaultMessage: "You don't have the permissions to access that content",
          })}
          {...props}
        />
      </Flex>
    </Main>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Protect
 * -----------------------------------------------------------------------------------------------*/
export interface ProtectProps {
  /**
   * The children to render if the user has the required permissions.
   * If providing a function, it will be called with an object containing
   * the permissions the user has based on the array you passed to the component.
   */
  children: React.ReactNode | ((args: { permissions: Permission[] }) => React.ReactNode);
  /**
   * The permissions the user needs to have to access the content.
   */
  permissions?: Array<Omit<Partial<Permission>, 'action'> & Pick<Permission, 'action'>>;
}

/**
 * @public
 * @description A wrapper component that should be used to protect a page. It will check the permissions
 * you pass to it and render the children if the user has the required permissions. If a user does not have ALL
 * the required permissions, it will redirect the user to the home page. Whilst these checks happen it will render
 * the loading component and should the check fail it will render the error component with a notification.
 */
const Protect = ({ permissions = [], children }: ProtectProps) => {
  const { allPermissions } = useRBACProvider();
  const toggleNotification = useNotification();
  const { _unstableFormatAPIError: formatAPIError } = useAPIErrorHandler();

  const matchingPermissions = allPermissions.filter(
    (permission) =>
      permissions.findIndex(
        (perm) => perm.action === permission.action && perm.subject === permission.subject
      ) >= 0
  );

  const shouldCheckConditions = matchingPermissions.some(
    (perm) => Array.isArray(perm.conditions) && perm.conditions.length > 0
  );

  const {
    isLoading,
    error,
    data = [],
  } = useCheckPermissionsQuery(
    {
      permissions: matchingPermissions.map((perm) => ({
        action: perm.action,
        subject: perm.subject,
      })),
    },
    {
      skip: !shouldCheckConditions,
    }
  );

  React.useEffect(() => {
    if (error) {
      toggleNotification({
        type: 'warning',
        message: formatAPIError(error),
      });
    }
  }, [error, formatAPIError, toggleNotification]);

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return <Error />;
  }

  const canAccess = shouldCheckConditions ? !data.includes(false) : matchingPermissions.length > 0;

  if (!canAccess) {
    return <NoPermissions />;
  }

  // @ts-expect-error this error comes from the fact we have permissions defined in the helper-plugin & admin, this will be resolved soon.
  return typeof children === 'function' ? children({ permissions: matchingPermissions }) : children;
};

const Page = {
  Error,
  Loading,
  NoPermissions,
  Protect,
};

export { Page };
export type { ErrorProps, LoadingProps, NoPermissionsProps };